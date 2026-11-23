from fastapi import APIRouter, Body
from app.services import download_service
from app.services.analysis_engine import AnalysisError

router = APIRouter()


def _safe(fn, data):
    try:
        return fn(data)
    except AnalysisError as exc:
        return {"status": "error", "message": str(exc)}
    except Exception as exc:  # noqa: BLE001 — readable message for the UI
        return {"status": "error", "message": str(exc)[:300]}


@router.post("/rasters")
def rasters(data: dict = Body(...)):
    return _safe(download_service.raster_links, data)


@router.post("/contours")
def contours(data: dict = Body(...)):
    return _safe(download_service.contours, data)


@router.post("/osm")
def osm(data: dict = Body(...)):
    return _safe(download_service.osm_layer, data)


@router.post("/gee-vector")
def gee_vector(data: dict = Body(...)):
    return _safe(download_service.gee_vector, data)


@router.get("/boundaries/{country}/{level}")
def boundary_geojson(country: str, level: str):
    """Simplified GeoJSON of one admin level (ADM1 provinces, ADM2 districts, ADM3 palikas)."""
    if level not in ("ADM0", "ADM1", "ADM2", "ADM3"):
        return {"status": "error", "message": "level must be ADM0–ADM3"}
    return _safe(lambda _: download_service.boundary_geojson(country.upper()[:3], level), None)


@router.get("/boundaries/{country}")
def boundaries(country: str = "NPL"):
    return _safe(lambda _: download_service.boundaries(country.upper()[:3]), None)
