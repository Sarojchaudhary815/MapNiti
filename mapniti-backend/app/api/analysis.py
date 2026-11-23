from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user, get_optional_user
from app.database import get_db
from app.models.analysis_run import AnalysisRun
from app.models.user import User
from app.services import analysis_engine, analysis_jobs

router = APIRouter()


@router.get("/crops")
def crops():
    return {"crops": [{"id": k, "name": v["name"]} for k, v in analysis_engine.CROPS.items()]}


# ---- background jobs + history (the tool UI uses these) -----------------------

@router.post("/jobs/{tool_id}")
def submit_job(tool_id: str, data: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Starts a run in the background (or answers at once from the cache). Poll GET /jobs/{id}."""
    try:
        run = analysis_jobs.submit(db, user.id, tool_id, data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return analysis_jobs.public(db, run, with_result=run.status == "done")


def _own_run(db, run_id: int, user: User) -> AnalysisRun:
    run = db.query(AnalysisRun).filter(AnalysisRun.id == run_id).first()
    if not run or (run.user_id != user.id and not user.is_admin):
        raise HTTPException(status_code=404, detail="Run not found.")
    return run


@router.get("/jobs/{run_id}")
def job_status(run_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    run = _own_run(db, run_id, user)
    return analysis_jobs.public(db, run, with_result=True)


@router.get("/history")
def history(limit: int = 50, tool_id: Optional[str] = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(AnalysisRun).filter(AnalysisRun.user_id == user.id)
    if tool_id:
        q = q.filter(AnalysisRun.tool_id == tool_id)
    runs = q.order_by(AnalysisRun.created_at.desc(), AnalysisRun.id.desc()).limit(max(1, min(limit, 200))).all()
    return {"runs": [analysis_jobs.public(db, r) for r in runs]}


@router.delete("/history/{run_id}")
def delete_run(run_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    run = _own_run(db, run_id, user)
    if run.status in ("queued", "running"):
        raise HTTPException(status_code=409, detail="This run is still working.")
    # Other runs may reuse this result from the cache: keep the row but drop it from the history.
    if db.query(AnalysisRun).filter(AnalysisRun.cached_from == run.id).first():
        run.user_id = None
    else:
        db.delete(run)
    db.commit()
    return {"status": "success"}


# ---- blocking endpoint (kept for scripts and older clients) ------------------

@router.post("/{tool_id}")
def run(tool_id: str, data: dict = Body(...), db: Session = Depends(get_db), user: Optional[User] = Depends(get_optional_user)):
    """Runs one analysis tool (urban-*, disaster-*, agri-*, hydro-*) for the AOI in data.geometry and waits for it."""
    if tool_id not in analysis_engine.TOOLS:
        return {"status": "error", "message": f"Unknown analysis '{tool_id}'."}
    try:
        return analysis_jobs.run_sync(db, user.id if user else None, tool_id, data)
    except ValueError as exc:
        return {"status": "error", "message": str(exc)}
