from fastapi import APIRouter

from app.services import realtime
from app.services.analysis_engine import AnalysisError

router = APIRouter()


def _safe(fn, *args):
    try:
        return fn(*args)
    except AnalysisError as exc:
        return {"status": "error", "message": str(exc)}


@router.get("/rivers")
def rivers():
    """Latest DHM river level per station (last 6 h), with warning/danger status."""
    return _safe(realtime.rivers)


@router.get("/rainfall")
def rainfall():
    """Latest DHM rain-gauge totals (1–24 h) per station."""
    return _safe(realtime.rainfall)


@router.get("/incidents")
def incidents(days: int = 30):
    """Disaster incidents reported on BIPAD in the last `days` days."""
    return _safe(realtime.incidents, days)
