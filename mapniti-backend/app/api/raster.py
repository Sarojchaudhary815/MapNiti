from fastapi import APIRouter, Body
from app.services import raster_service

router = APIRouter()


@router.post("/spectral-index")
def spectral_index(data: dict = Body(...)):
    """NDVI / NDWI / NDBI — data.index_type selects which one."""
    return raster_service.compute_spectral_index(data)


@router.post("/custom-expression")
def custom_expression(data: dict = Body(...)):
    """Raster Calculator — arbitrary band-math expression."""
    return raster_service.compute_custom_expression(data)


@router.post("/preview-imagery")
def preview_imagery(data: dict = Body(...)):
    """True-color composite preview, shown on the map before placing LULC training samples."""
    return raster_service.preview_composite(data)


@router.post("/lulc/supervised")
def lulc_supervised(data: dict = Body(...)):
    return raster_service.run_supervised_classification(data)


@router.post("/lulc/unsupervised")
def lulc_unsupervised(data: dict = Body(...)):
    return raster_service.run_unsupervised_classification(data)


@router.post("/lulc/preclassified")
def lulc_preclassified(data: dict = Body(...)):
    return raster_service.run_preclassified_lulc(data)
