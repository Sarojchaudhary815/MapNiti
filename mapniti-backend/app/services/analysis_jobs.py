"""Background analysis jobs, run history and the result cache.

A run is stored as an AnalysisRun row and computed in a small thread pool, so
the browser only polls for it: a slow Earth Engine job no longer ties up an HTTP
request, the user can switch tools while it works, and the result is kept.

Cache: the same tool with the same inputs (geometry + parameters) reuses the
newest finished run. Earth Engine tile URLs in a result stop working after a
while, so results with map layers are reused for LAYER_TTL only; results that
are pure numbers/vectors for DATA_TTL.
"""
import hashlib
import json
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta

from app.database import SessionLocal
from app.models.analysis_run import AnalysisRun
from app.services import analysis_engine

logger = logging.getLogger(__name__)

LAYER_TTL = timedelta(hours=6)
DATA_TTL = timedelta(days=7)
NOT_INPUTS = {"refresh", "aoi_name", "project_id"}   # request fields that don't change the result
_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="analysis")


def _geometry_of(data):
    g = data.get("geometry")
    if isinstance(g, dict) and g.get("type") == "Feature":
        g = g.get("geometry")
    return g


def cache_key(tool_id: str, data: dict) -> str:
    inputs = {k: v for k, v in data.items() if k not in NOT_INPUTS and k != "geometry"}
    blob = json.dumps({"tool": tool_id, "geometry": _geometry_of(data), "inputs": inputs},
                      sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(blob.encode()).hexdigest()


def _ttl(result: dict) -> timedelta:
    return LAYER_TTL if result.get("layers") else DATA_TTL


def _result_of(db, run: AnalysisRun):
    src = run
    if run.cached_from:
        src = db.query(AnalysisRun).filter(AnalysisRun.id == run.cached_from).first() or run
    return json.loads(src.result_json) if src.result_json else None, src


def find_cached(db, key: str):
    now = datetime.utcnow()
    for run in (db.query(AnalysisRun)
                .filter(AnalysisRun.cache_key == key, AnalysisRun.status == "done", AnalysisRun.result_json.isnot(None))
                .order_by(AnalysisRun.created_at.desc()).limit(3)):
        result = json.loads(run.result_json)
        if run.finished_at and now - run.finished_at < _ttl(result):
            return run, result
    return None, None


def _execute(run_id: int, tool_id: str, data: dict):
    db = SessionLocal()
    try:
        run = db.query(AnalysisRun).filter(AnalysisRun.id == run_id).first()
        if not run:
            return
        run.status = "running"
        db.commit()
        t0 = time.time()
        res = analysis_engine.run_tool(tool_id, data)
        run.seconds = round(time.time() - t0, 1)
        run.finished_at = datetime.utcnow()
        if res.get("status") == "success":
            run.status = "done"
            run.result_json = json.dumps(res, default=str)
        else:
            run.status = "error"
            run.error = (res.get("message") or "Analysis failed.")[:2000]
        db.commit()
    except Exception as exc:  # noqa: BLE001 — never leave a run stuck in "running"
        logger.exception("analysis job %s failed", run_id)
        db.rollback()
        run = db.query(AnalysisRun).filter(AnalysisRun.id == run_id).first()
        if run:
            run.status, run.error, run.finished_at = "error", str(exc)[:2000], datetime.utcnow()
            db.commit()
    finally:
        db.close()


def submit(db, user_id, tool_id: str, data: dict) -> AnalysisRun:
    if tool_id not in analysis_engine.TOOLS:
        raise ValueError(f"Unknown analysis '{tool_id}'.")
    if not _geometry_of(data):
        raise ValueError("Select an area of interest first.")
    key = cache_key(tool_id, data)
    params = {k: v for k, v in data.items() if k not in NOT_INPUTS and k != "geometry"}
    run = AnalysisRun(user_id=user_id, tool_id=tool_id, cache_key=key,
                      aoi_name=(data.get("aoi_name") or "")[:200] or None,
                      params_json=json.dumps(params, default=str),
                      aoi_geojson=json.dumps(data.get("geometry")))
    if not data.get("refresh"):
        hit, _ = find_cached(db, key)
        if hit:
            run.status, run.cached_from, run.finished_at, run.seconds = "done", hit.id, datetime.utcnow(), 0
            db.add(run)
            db.commit()
            db.refresh(run)
            return run
    db.add(run)
    db.commit()
    db.refresh(run)
    clean = {k: v for k, v in data.items() if k not in NOT_INPUTS}
    _pool.submit(_execute, run.id, tool_id, clean)
    return run


def run_sync(db, user_id, tool_id: str, data: dict) -> dict:
    """The old blocking endpoint, now cached and recorded too."""
    run = submit(db, user_id, tool_id, data)
    while run.status in ("queued", "running"):
        time.sleep(1)
        db.refresh(run)
    return public(db, run, with_result=True)["result"] if run.status == "done" else \
        {"status": "error", "message": run.error or "Analysis failed."}


def public(db, run: AnalysisRun, with_result=False) -> dict:
    d = {
        "id": run.id, "tool_id": run.tool_id, "status": run.status, "aoi_name": run.aoi_name,
        "params": json.loads(run.params_json or "{}"), "error": run.error,
        "cached": bool(run.cached_from), "seconds": run.seconds,
        "created_at": run.created_at.isoformat() + "Z" if run.created_at else None,
        "finished_at": run.finished_at.isoformat() + "Z" if run.finished_at else None,
    }
    if with_result and run.status == "done":
        result, src = _result_of(db, run)
        if result is not None:
            age = datetime.utcnow() - (src.finished_at or src.created_at)
            result["cached"] = bool(run.cached_from)
            result["computed_at"] = (src.finished_at or src.created_at).isoformat() + "Z"
            if result.get("layers") and age > LAYER_TTL:
                result["layers_expired"] = True
        d["result"] = result
        d["aoi_geojson"] = json.loads(run.aoi_geojson) if run.aoi_geojson else None
    return d


def recover_on_startup():
    """Runs that were in flight when the server stopped will never finish."""
    db = SessionLocal()
    try:
        n = (db.query(AnalysisRun).filter(AnalysisRun.status.in_(["queued", "running"]))
             .update({"status": "error", "error": "The server restarted while this was running. Run it again.",
                      "finished_at": datetime.utcnow()}, synchronize_session=False))
        db.commit()
        if n:
            logger.info("marked %d interrupted analysis runs as failed", n)
    finally:
        db.close()
