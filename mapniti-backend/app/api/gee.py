from fastapi import APIRouter, Body
from app.services import gee_catalog

router = APIRouter()


@router.get("/catalog")
def catalog():
    """Curated GEE datasets (terrain, land cover, climate, soil, people, ...)."""
    return gee_catalog.list_catalog()


@router.post("/layer")
def layer(data: dict = Body(...)):
    """Map tiles + AOI statistics + GeoTIFF link for one catalog dataset."""
    return gee_catalog.fetch_layer(data)


@router.post("/timeseries")
def timeseries(data: dict = Body(...)):
    """Monthly / yearly AOI-mean series for time-based datasets."""
    return gee_catalog.fetch_timeseries(data)


@router.post("/custom")
def custom(data: dict = Body(...)):
    """Any public GEE Image / ImageCollection by asset ID."""
    return gee_catalog.fetch_custom(data)
