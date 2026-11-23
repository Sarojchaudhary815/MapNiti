from fastapi import APIRouter, Body
from app.services import hydrology_engine, hms_engine, ras_engine, impact_engine

router = APIRouter()


@router.post("/fetch-dem-gee")
def fetch_dem_gee(data: dict = Body(...)):
    return hydrology_engine.fetch_dem(data)


@router.post("/analyze-flow")
def analyze_flow(data: dict = Body(...)):
    return hydrology_engine.analyze_flow(data)


@router.post("/delineate-watershed")
def delineate_watershed(data: dict = Body(...)):
    return hydrology_engine.delineate_watershed(data)


@router.post("/historical-floods")
def historical_floods(data: dict = Body(...)):
    return hydrology_engine.get_historical_floods(data)


@router.post("/flood-hazard-analysis")
def flood_hazard_analysis(data: dict = Body(...)):
    """
    Section A ("Run GEE Analysis") — runs the full pre/post SAR flood
    extraction and returns all four layers plus summary statistics.
    """
    return hydrology_engine.analyze_flood_hazard(data)


@router.post("/flood-hazard-before")
def flood_hazard_before(data: dict = Body(...)):
    """Step 1 of the flood workflow — pre-flood Sentinel-1 mosaic only."""
    return hydrology_engine.analyze_flood_before(data)


@router.post("/flood-hazard-after")
def flood_hazard_after(data: dict = Body(...)):
    """Step 2 of the flood workflow — post-flood Sentinel-1 mosaic only."""
    return hydrology_engine.analyze_flood_after(data)


@router.post("/flood-hazard-combine")
def flood_hazard_combine(data: dict = Body(...)):
    """Step 3 of the flood workflow — combine pre/post into flood extent + stats."""
    return hydrology_engine.combine_flood_hazard(data)


@router.post("/flood-recolor")
def flood_recolor(data: dict = Body(...)):
    """
    Section B (colour picker on the "Inundated Areas" layer) — re-renders
    just the flood-extent layer with a new colour.
    """
    return hydrology_engine.recolor_flood_layer(data)


# ============================================================
# HEC-HMS-equivalent — Rainfall-Runoff Modeling (SCS-CN + Unit Hydrograph)
# ============================================================

@router.post("/hms/basin-parameters")
def hms_basin_parameters(data: dict = Body(...)):
    """Step 1 — derive area, curve number, slope, Tc for the selected basin."""
    return hms_engine.get_basin_parameters(data)


@router.post("/hms/run-runoff")
def hms_run_runoff(data: dict = Body(...)):
    """Step 2 — run the SCS-CN loss + SCS Unit Hydrograph transform."""
    return hms_engine.run_rainfall_runoff(data)


# ============================================================
# HEC-RAS-equivalent — Hydraulic Flood Routing (HAND + Manning's Rating Curve)
# ============================================================

@router.post("/ras/hand")
def ras_hand(data: dict = Body(...)):
    """Step 1 — compute the HAND raster and suggested channel properties."""
    return ras_engine.compute_hand(data)


@router.post("/ras/rating-curve")
def ras_rating_curve(data: dict = Body(...)):
    """Step 2 — build the Manning's-equation synthetic stage-discharge curve."""
    return ras_engine.build_rating_curve(data)


@router.post("/ras/inundate")
def ras_inundate(data: dict = Body(...)):
    """Step 3 — given a design discharge, find the stage and render flood extent + depth."""
    return ras_engine.run_inundation(data)


@router.post("/ras/simulate-flood-rise")
def ras_simulate_flood_rise(data: dict = Body(...)):
    """Depth raster frames at increasing stages, for animating a rising/spreading flood."""
    return ras_engine.simulate_flood_rise(data)


@router.post("/ras/flow-direction")
def ras_flow_direction(data: dict = Body(...)):
    """Approximate upstream->downstream flow-direction line for map visualization."""
    return ras_engine.get_flow_direction(data)


@router.post("/ras/flood-flow-field")
def ras_flood_flow_field(data: dict = Body(...)):
    """Points spread across the whole flood extent + bearing, for animating flow across the full water surface."""
    return ras_engine.get_flood_flow_field(data)


# ============================================================
# Flood Impact — building & road exposure on top of the flood extent
# ============================================================

@router.post("/impact/buildings")
def impact_buildings(data: dict = Body(...)):
    """Fetch building footprints (Google Open Buildings) for the AOI."""
    return impact_engine.get_buildings(data)


@router.post("/impact/uploaded-buildings")
def impact_uploaded_buildings(data: dict = Body(...)):
    """Flood-exposure analysis against a user-uploaded building GeoJSON."""
    return impact_engine.analyze_uploaded_buildings(data)


@router.post("/impact/roads")
def impact_roads(data: dict = Body(...)):
    """Fetch OSM road centrelines for a bounding box."""
    return impact_engine.get_roads(data)


@router.post("/impact/building-flood-impact")
def impact_building_flood_impact(data: dict = Body(...)):
    """Zonal-stats exposure: tag every building affected/flood_fraction/depth_m."""
    return impact_engine.analyze_building_impact(data)