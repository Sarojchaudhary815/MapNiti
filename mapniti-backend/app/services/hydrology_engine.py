"""
Hydrology Engine
================
All GEE geoprocessing logic lives here. The API route file (hydrology.py)
is just a thin wrapper around these functions.
"""
import logging
import ee
from app.config import GEE_PROJECT_ID, GEE_SERVICE_ACCOUNT_EMAIL, GEE_SERVICE_ACCOUNT_KEY_PATH

# WorldPop R2025A (constrained, 2015-2030; years after the latest census are projections).
# Replaces the deprecated WorldPop/GP/100m/pop. Band name: 'population'. Native grid ~92.77 m.
WORLDPOP_ASSET = "WorldPop/GP/100m/R2025A/v1/pop"
WORLDPOP_YEAR = 2025
WORLDPOP_YEARS = (2015, 2030)
WORLDPOP_SCALE = 92.77


def worldpop_image(year=WORLDPOP_YEAR):
    """WorldPop people-per-cell mosaic for one year (band "population")."""
    year = max(WORLDPOP_YEARS[0], min(WORLDPOP_YEARS[1], int(year)))
    return ee.ImageCollection(WORLDPOP_ASSET).filter(ee.Filter.eq("year", year)).mosaic()


logger = logging.getLogger("mapniti.hydrology")

_ee_initialized = False


def init_earth_engine():
    global _ee_initialized
    if _ee_initialized:
        return
    try:
        if GEE_SERVICE_ACCOUNT_EMAIL and GEE_SERVICE_ACCOUNT_KEY_PATH:
            credentials = ee.ServiceAccountCredentials(
                GEE_SERVICE_ACCOUNT_EMAIL, GEE_SERVICE_ACCOUNT_KEY_PATH
            )
            ee.Initialize(credentials, project=GEE_PROJECT_ID)
        else:
            ee.Initialize(project=GEE_PROJECT_ID)
        _ee_initialized = True
    except Exception as exc:
        logger.error(f"Earth Engine initialization failed: {exc}")
        raise RuntimeError(
            "Earth Engine could not be initialized. Run 'earthengine authenticate' "
            "locally, or set GEE_SERVICE_ACCOUNT_EMAIL / GEE_SERVICE_ACCOUNT_KEY_PATH in .env"
        ) from exc


# Supported DEM sources — real, verified Google Earth Engine datasets
DEM_SOURCES = {
    "SRTM":       {"asset": "USGS/SRTMGL1_003",        "band": "elevation", "collection": False},
    "COPERNICUS": {"asset": "COPERNICUS/DEM/GLO30",    "band": "DEM",       "collection": True},
    "ALOS":       {"asset": "JAXA/ALOS/AW3D30/V4_1",   "band": "DSM",       "collection": True},
    "NASADEM":    {"asset": "NASA/NASADEM_HGT/001",    "band": "elevation", "collection": False},
}


def get_dem_image(dem_source: str, roi):
    """Returns a clipped ee.Image for the chosen DEM source (defaults to SRTM)."""
    source = DEM_SOURCES.get(dem_source, DEM_SOURCES["SRTM"])
    if source["collection"]:
        img = ee.ImageCollection(source["asset"]).mosaic().select(source["band"])
    else:
        img = ee.Image(source["asset"]).select(source["band"])
    return img.clip(roi)


def get_roi(data: dict):
    geojson = data.get("geometry")
    if not geojson:
        return None
    geom_type = geojson.get("type")
    if geom_type == "FeatureCollection":
        geom_data = geojson["features"][0]["geometry"]
    elif geom_type == "Feature":
        geom_data = geojson["geometry"]
    else:
        geom_data = geojson
    return ee.Geometry(geom_data)


def fetch_dem(data: dict) -> dict:
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        return {"status": "error", "message": "No ROI (geometry) provided"}

    try:
        dem_source = data.get("dem_source", "SRTM")
        dem = get_dem_image(dem_source, roi)
        hillshade = ee.Terrain.hillshade(dem)

        vis_params = {"min": 0, "max": 255, "palette": ["black", "white"]}
        map_id = hillshade.getMapId(vis_params)

        # The map tile is a stylised hillshade (0-255 grey), but the download
        # is the real elevation raster (metres) — much more useful to open
        # in GIS software than a flattened greyscale render.
        download_url = _get_geotiff_url(dem.rename("elevation_m"), roi, 30)

        return {
            "status": "success",
            "layers": [
                {
                    "layerId": "dem",
                    "name": f"Elevation (DEM Hillshade) — {dem_source}",
                    "visual_url": map_id["tile_fetcher"].url_format,
                    "download_url": download_url,
                }
            ],
        }
    except Exception as exc:
        logger.exception("fetch_dem failed")
        return {"status": "error", "message": str(exc)}


def analyze_flow(data: dict) -> dict:
    """
    Flow accumulation, from HydroSHEDS (WWF/HydroSHEDS/15ACC).

    IMPORTANT: raw accumulation values can reach into the thousands/millions
    for large basins, so a linear stretch (min/max) would paint the entire
    area a single solid colour (the thin stream lines wouldn't show up).
    A log-scale stretch instead produces a thin, clearly visible "stream
    network" look — which is standard practice in hydrology.
    """
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        return {"status": "error", "message": "No ROI (geometry) provided"}

    try:
        accumulation = ee.Image("WWF/HydroSHEDS/15ACC").select("b1").clip(roi)

        threshold = data.get("threshold", 500)  # removes small noise streams
        stream_network = accumulation.updateMask(accumulation.gt(threshold))

        # Log10 stretch — for thin, visible stream lines
        log_acc = stream_network.log10()

        palette = ["#a5f3fc", "#38bdf8", "#0369a1", "#082f49"]  # light cyan -> dark navy
        vis_params = {"min": 2, "max": 5, "palette": palette}   # log10(100) to log10(100000)

        acc_map = log_acc.getMapId(vis_params)
        # Download the raw (un-logged) accumulation counts, not the
        # log10-stretched visualisation — actual pixel values are more
        # useful for further analysis than a display-only transform.
        download_url = _get_geotiff_url(stream_network.rename("accumulation"), roi, 500)

        return {
            "status": "success",
            "layers": [
                {
                    "layerId": "flow",
                    "name": "Flow Accumulation",
                    "visual_url": acc_map["tile_fetcher"].url_format,
                    "download_url": download_url,
                }
            ],
        }
    except Exception as exc:
        logger.exception("analyze_flow failed")
        return {"status": "error", "message": str(exc)}


def delineate_watershed(data: dict) -> dict:
    init_earth_engine()
    outlets = data.get("outlets", [])
    if not outlets:
        return {"status": "error", "message": "No outlet point provided"}

    try:
        point = ee.Geometry.Point([outlets[0]["lng"], outlets[0]["lat"]])
        basins = ee.FeatureCollection("WWF/HydroSHEDS/v1/Basins/hybas_12")
        selected_basin = basins.filterBounds(point)

        area_sq_km = selected_basin.geometry().area().divide(1_000_000).round().getInfo()
        map_id = selected_basin.getMapId({"color": "#FF3300", "opacity": 0.6})

        # Vector (GeoJSON) download — not raster, so getDownloadURL('geojson') is used
        download_url = selected_basin.getDownloadURL("geojson")

        return {
            "status": "success",
            "layerId": "catchment",
            "visual_url": map_id["tile_fetcher"].url_format,
            "download_url": download_url,
            "area_km2": area_sq_km,
        }
    except Exception as exc:
        logger.exception("delineate_watershed failed")
        return {"status": "error", "message": str(exc)}


def get_historical_floods(data: dict) -> dict:
    """
    Real historical flood data from the Global Flood Database
    (Dartmouth Flood Observatory + Cloud to Street, MODIS-based).
    Covers 913 mapped flood events from 2000-2018 at 250m resolution.
    Shows: (1) a "flood frequency" layer — how many times each pixel
    flooded, and (2) a list of the specific events that hit this area.
    """
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        return {"status": "error", "message": "No ROI (geometry) provided"}

    try:
        start_year = data.get("start_year", 2000)
        end_year = data.get("end_year", 2018)
        start_date = f"{start_year}-01-01"
        end_date = f"{end_year}-12-31"

        flood_collection = (
            ee.ImageCollection("GLOBAL_FLOOD_DB/MODIS_EVENTS/V1")
            .filterDate(start_date, end_date)
            .filterBounds(roi)
        )

        event_count = flood_collection.size().getInfo()
        if event_count == 0:
            return {
                "status": "success",
                "layers": [],
                "event_count": 0,
                "events": [],
                "message": "No recorded flood events found for this area/date range.",
            }

        # "Flood frequency" - how many recorded events touched each pixel
        flood_frequency = flood_collection.select("flooded").sum().clip(roi)
        vis_params = {"min": 0, "max": event_count, "palette": ["#ffffff", "#93c5fd", "#2563eb", "#1e3a8a"]}
        map_id = flood_frequency.getMapId(vis_params)
        download_url = _get_geotiff_url(flood_frequency.rename("flood_event_count"), roi, 250)

        # List of specific events (date/country) that affected this area
        event_ids = flood_collection.aggregate_array("system:index").getInfo()
        began_dates = flood_collection.aggregate_array("began").getInfo()
        ended_dates = flood_collection.aggregate_array("ended").getInfo()
        countries = flood_collection.aggregate_array("countries").getInfo()

        events = []
        for i in range(len(event_ids)):
            events.append({
                "id": event_ids[i],
                "began": began_dates[i] if i < len(began_dates) else None,
                "ended": ended_dates[i] if i < len(ended_dates) else None,
                "countries": countries[i] if i < len(countries) else None,
            })

        return {
            "status": "success",
            "layers": [
                {
                    "layerId": "flood_history",
                    "name": "Historical Flood Frequency",
                    "visual_url": map_id["tile_fetcher"].url_format,
                    "download_url": download_url,
                }
            ],
            "event_count": event_count,
            "events": events,
        }
    except Exception as exc:
        logger.exception("get_historical_floods failed")
        return {"status": "error", "message": str(exc)}


# ============================================================
# Flood Hazard Mapping — SAR-based flood extent extraction
# ============================================================

DEFAULT_FLOOD_COLOR = "#2563eb"  # default flood-extent colour (blue)


def _hex_to_gee_palette(hex_color: str):
    """
    Builds a 2-step GEE palette for a binary (single-colour) mask:
    fully transparent for 0, the chosen colour for 1.
    """
    hex_color = (hex_color or DEFAULT_FLOOD_COLOR).lstrip("#")
    return ["ffffff00", hex_color]


def _get_sentinel1_vv(roi, start_date, end_date):
    """Returns a speckle-filtered Sentinel-1 VV mosaic clipped to the ROI, or None if empty."""
    collection = (
        ee.ImageCollection("COPERNICUS/S1_GRD")
        .filterBounds(roi)
        .filter(ee.Filter.eq("instrumentMode", "IW"))
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
        .select("VV")
        .filterDate(start_date, end_date)
    )

    count = collection.size().getInfo()
    if count == 0:
        return None

    mosaic = collection.mosaic()
    filtered = mosaic.focal_median(50, "circle", "meters")
    return filtered.clip(roi)


def _get_permanent_water_mask(roi):
    """JRC Global Surface Water — pixels with >50% historical water occurrence."""
    return (
        ee.Image("JRC/GSW1_4/GlobalSurfaceWater")
        .select("occurrence")
        .gt(50)
        .clip(roi)
    )


def analyze_flood_hazard(data: dict) -> dict:
    """
    Legacy single-shot version (kept for backward compatibility — no longer
    called by the frontend, which now uses the Before / After / Combine
    steps below instead).

    Sentinel-1 SAR (VV backscatter) based flood extent extraction.
    """
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        return {"status": "error", "message": "No ROI (geometry) provided"}

    try:
        pre_start = data.get("pre_start_date")
        pre_end = data.get("pre_end_date")
        post_start = data.get("post_start_date")
        post_end = data.get("post_end_date")
        flood_color = data.get("flood_color", DEFAULT_FLOOD_COLOR)
        water_threshold = data.get("water_threshold", -16)  # dB

        if not all([pre_start, pre_end, post_start, post_end]):
            return {"status": "error", "message": "pre/post flood start & end dates are required"}

        pre_image = _get_sentinel1_vv(roi, pre_start, pre_end)
        if pre_image is None:
            return {"status": "error", "message": "No Sentinel-1 imagery found for the pre-flood date range."}

        post_image = _get_sentinel1_vv(roi, post_start, post_end)
        if post_image is None:
            return {"status": "error", "message": "No Sentinel-1 imagery found for the post-flood date range."}

        post_water = post_image.lt(water_threshold).selfMask()
        permanent_water = _get_permanent_water_mask(roi)

        # Flood = post-flood water that is NOT already permanent water
        flood_extent = post_water.updateMask(permanent_water.unmask(0).eq(0)).selfMask()

        # ---- Visualizations ----
        sar_vis = {"min": -25, "max": 0}
        pre_map = pre_image.getMapId(sar_vis)
        post_map = post_image.getMapId(sar_vis)

        water_vis = {"palette": ["ffffff00", "0ea5e9"]}
        permanent_water_masked = permanent_water.updateMask(permanent_water)
        water_map = permanent_water_masked.getMapId(water_vis)

        flood_vis = {"palette": _hex_to_gee_palette(flood_color)}
        flood_map = flood_extent.getMapId(flood_vis)

        # ---- Stats: flooded area (km2) ----
        pixel_area_km2 = ee.Image.pixelArea().divide(1_000_000)
        area_result = pixel_area_km2.updateMask(flood_extent).reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=roi,
            scale=30,
            maxPixels=1e10,
            bestEffort=True,
        )
        flooded_area_km2 = area_result.get("area", ee.Number(0)).getInfo() or 0

        # ---- Stats: affected population (WorldPop) ----
        affected_population = None
        try:
            pop_image = (
                worldpop_image().clip(roi)
            )
            pop_result = pop_image.updateMask(flood_extent).reduceRegion(
                reducer=ee.Reducer.sum(),
                geometry=roi,
                scale=WORLDPOP_SCALE,
                maxPixels=1e10,
                bestEffort=True,
            )
            pop_value = pop_result.get("population")
            if pop_value is not None:
                affected_population = ee.Number(pop_value).getInfo()
        except Exception:
            logger.warning("Population estimate failed, continuing without it.", exc_info=True)

        def _safe_thumb(img, vis):
            try:
                return img.getThumbURL({**vis, "region": roi, "dimensions": 512, "format": "png"})
            except Exception:
                logger.warning("Thumbnail/download URL generation failed for a layer.", exc_info=True)
                return None

        return {
            "status": "success",
            "layers": [
                {
                    "layerId": "pre_flood",
                    "name": "Pre-Flood Imagery (Sentinel-1)",
                    "visual_url": pre_map["tile_fetcher"].url_format,
                    "download_url": _safe_thumb(pre_image, sar_vis),
                    "recolorable": False,
                },
                {
                    "layerId": "post_flood",
                    "name": "Post-Flood Imagery (Sentinel-1)",
                    "visual_url": post_map["tile_fetcher"].url_format,
                    "download_url": _safe_thumb(post_image, sar_vis),
                    "recolorable": False,
                },
                {
                    "layerId": "permanent_water",
                    "name": "Extracted Water Bodies (Permanent)",
                    "visual_url": water_map["tile_fetcher"].url_format,
                    "download_url": _safe_thumb(permanent_water_masked, water_vis),
                    "recolorable": False,
                },
                {
                    "layerId": "flood_extent",
                    "name": "Inundated Areas (Flood Extent)",
                    "visual_url": flood_map["tile_fetcher"].url_format,
                    "download_url": _safe_thumb(flood_extent, flood_vis),
                    "recolorable": True,
                    "color": flood_color,
                },
            ],
            "stats": {
                "flooded_area_km2": round(flooded_area_km2, 2),
                "affected_population": round(affected_population) if affected_population is not None else None,
            },
        }
    except Exception as exc:
        logger.exception("analyze_flood_hazard failed")
        return {"status": "error", "message": str(exc)}


def recolor_flood_layer(data: dict) -> dict:
    """
    Called by the colour-picker in the Layer Management panel.
    Re-runs the flood-extent extraction (GEE is stateless, so the mask
    can't be cached server-side between requests) and re-renders it
    with the newly chosen colour, without recomputing the other layers.
    """
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        return {"status": "error", "message": "No ROI (geometry) provided"}

    try:
        post_start = data.get("post_start_date")
        post_end = data.get("post_end_date")
        new_color = data.get("flood_color", DEFAULT_FLOOD_COLOR)
        water_threshold = data.get("water_threshold", -16)

        if not post_start or not post_end:
            return {"status": "error", "message": "post_start_date and post_end_date are required"}

        post_image = _get_sentinel1_vv(roi, post_start, post_end)
        if post_image is None:
            return {"status": "error", "message": "No Sentinel-1 imagery found for the post-flood date range."}

        post_water = post_image.lt(water_threshold).selfMask()
        permanent_water = _get_permanent_water_mask(roi)
        flood_extent = post_water.updateMask(permanent_water.unmask(0).eq(0)).selfMask()

        flood_vis = {"palette": _hex_to_gee_palette(new_color)}
        flood_map = flood_extent.getMapId(flood_vis)

        return {
            "status": "success",
            "layerId": "flood_extent",
            "visual_url": flood_map["tile_fetcher"].url_format,
            "color": new_color,
        }
    except Exception as exc:
        logger.exception("recolor_flood_layer failed")
        return {"status": "error", "message": str(exc)}


# ============================================================
# NEW: Flood Hazard Mapping — split into Before / After / Combine
# ============================================================

def _get_geotiff_url(img, roi, scale):
    """
    Real GeoTIFF download link for a raster layer — preserves actual pixel
    values (elevation, accumulation counts, depth in metres, etc.) plus
    georeferencing/CRS, so the file opens directly in QGIS/ArcGIS. This
    replaces the old getThumbURL()-based PNG download, which only ever
    produced a flattened, palette-coloured 512x512 image with no real data
    in it.
    """
    try:
        return img.getDownloadURL({"region": roi, "scale": scale, "format": "GEO_TIFF", "crs": "EPSG:4326"})
    except Exception:
        logger.warning("GeoTIFF download URL generation failed for a layer.", exc_info=True)
        return None


def analyze_flood_before(data: dict) -> dict:
    """
    Step 1 of the flood workflow — fetches & renders only the pre-flood
    Sentinel-1 mosaic. Returns a single "pre_flood" layer.
    """
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        return {"status": "error", "message": "No ROI (geometry) provided"}

    try:
        pre_start = data.get("pre_start_date")
        pre_end = data.get("pre_end_date")
        if not pre_start or not pre_end:
            return {"status": "error", "message": "pre_start_date and pre_end_date are required"}

        pre_image = _get_sentinel1_vv(roi, pre_start, pre_end)
        if pre_image is None:
            return {"status": "error", "message": "No Sentinel-1 imagery found for the pre-flood date range."}

        sar_vis = {"min": -25, "max": 0}
        pre_map = pre_image.getMapId(sar_vis)

        return {
            "status": "success",
            "layers": [
                {
                    "layerId": "pre_flood",
                    "name": "Pre-Flood Imagery (Sentinel-1)",
                    "visual_url": pre_map["tile_fetcher"].url_format,
                    "download_url": _get_geotiff_url(pre_image, roi, 10),
                    "recolorable": False,
                },
            ],
        }
    except Exception as exc:
        logger.exception("analyze_flood_before failed")
        return {"status": "error", "message": str(exc)}


def analyze_flood_after(data: dict) -> dict:
    """
    Step 2 of the flood workflow — fetches & renders only the post-flood
    Sentinel-1 mosaic. Returns a single "post_flood" layer.
    """
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        return {"status": "error", "message": "No ROI (geometry) provided"}

    try:
        post_start = data.get("post_start_date")
        post_end = data.get("post_end_date")
        if not post_start or not post_end:
            return {"status": "error", "message": "post_start_date and post_end_date are required"}

        post_image = _get_sentinel1_vv(roi, post_start, post_end)
        if post_image is None:
            return {"status": "error", "message": "No Sentinel-1 imagery found for the post-flood date range."}

        sar_vis = {"min": -25, "max": 0}
        post_map = post_image.getMapId(sar_vis)

        return {
            "status": "success",
            "layers": [
                {
                    "layerId": "post_flood",
                    "name": "Post-Flood Imagery (Sentinel-1)",
                    "visual_url": post_map["tile_fetcher"].url_format,
                    "download_url": _get_geotiff_url(post_image, roi, 10),
                    "recolorable": False,
                },
            ],
        }
    except Exception as exc:
        logger.exception("analyze_flood_after failed")
        return {"status": "error", "message": str(exc)}


def combine_flood_hazard(data: dict) -> dict:
    """
    Step 3 of the flood workflow ("Combine") — GEE is stateless, so the
    post-flood mosaic is recomputed here from post_start/post_end (already
    known to the frontend from Step 2), then compared against permanent
    water to extract the actual flood extent + stats.
    """
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        return {"status": "error", "message": "No ROI (geometry) provided"}

    try:
        post_start = data.get("post_start_date")
        post_end = data.get("post_end_date")
        flood_color = data.get("flood_color", DEFAULT_FLOOD_COLOR)
        water_threshold = data.get("water_threshold", -16)

        if not post_start or not post_end:
            return {"status": "error", "message": "post_start_date and post_end_date are required"}

        post_image = _get_sentinel1_vv(roi, post_start, post_end)
        if post_image is None:
            return {"status": "error", "message": "No Sentinel-1 imagery found for the post-flood date range."}

        post_water = post_image.lt(water_threshold).selfMask()
        permanent_water = _get_permanent_water_mask(roi)
        flood_extent = post_water.updateMask(permanent_water.unmask(0).eq(0)).selfMask()

        water_vis = {"palette": ["ffffff00", "0ea5e9"]}
        permanent_water_masked = permanent_water.updateMask(permanent_water)
        water_map = permanent_water_masked.getMapId(water_vis)

        flood_vis = {"palette": _hex_to_gee_palette(flood_color)}
        flood_map = flood_extent.getMapId(flood_vis)

        pixel_area_km2 = ee.Image.pixelArea().divide(1_000_000)
        area_result = pixel_area_km2.updateMask(flood_extent).reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=roi,
            scale=30,
            maxPixels=1e10,
            bestEffort=True,
        )
        flooded_area_km2 = area_result.get("area", ee.Number(0)).getInfo() or 0

        affected_population = None
        try:
            pop_image = (
                worldpop_image().clip(roi)
            )
            pop_result = pop_image.updateMask(flood_extent).reduceRegion(
                reducer=ee.Reducer.sum(),
                geometry=roi,
                scale=WORLDPOP_SCALE,
                maxPixels=1e10,
                bestEffort=True,
            )
            pop_value = pop_result.get("population")
            if pop_value is not None:
                affected_population = ee.Number(pop_value).getInfo()
        except Exception:
            logger.warning("Population estimate failed, continuing without it.", exc_info=True)

        return {
            "status": "success",
            "layers": [
                {
                    "layerId": "permanent_water",
                    "name": "Extracted Water Bodies (Permanent)",
                    "visual_url": water_map["tile_fetcher"].url_format,
                    "download_url": _get_geotiff_url(permanent_water_masked, roi, 30),
                    "recolorable": False,
                },
                {
                    "layerId": "flood_extent",
                    "name": "Inundated Areas (Flood Extent)",
                    "visual_url": flood_map["tile_fetcher"].url_format,
                    "download_url": _get_geotiff_url(flood_extent, roi, 10),
                    "recolorable": True,
                    "color": flood_color,
                },
            ],
            "stats": {
                "flooded_area_km2": round(flooded_area_km2, 2),
                "affected_population": round(affected_population) if affected_population is not None else None,
            },
        }
    except Exception as exc:
        logger.exception("combine_flood_hazard failed")
        return {"status": "error", "message": str(exc)}