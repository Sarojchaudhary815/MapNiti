"""
Flood Impact Engine
=====================
Building and road exposure analysis layered on top of the HEC-RAS-
equivalent flood extent from ras_engine.py:

  - Building footprints from Google's Open Buildings v3 dataset (GEE) —
    real per-building polygons with an area_in_meters + confidence score
    (developers.google.com/earth-engine/datasets/catalog/
    GOOGLE_Research_open-buildings_v3_polygons).
  - Road centrelines from OpenStreetMap via the public Overpass API.
    GEE has no equivalent authoritative road-vector catalog, so this is
    a plain HTTP call rather than a GEE computation.
  - Per-building flood exposure via zonal statistics (reduceRegions)
    against the flood-extent + depth rasters, which auto-tags every
    building with "affected" / "flood_fraction" / "depth_m" attributes.
"""
import logging
import ee
from app.services.hydrology_engine import init_earth_engine, get_roi, get_dem_image
from app.services.ras_engine import (
    _hand_and_streams, STREAM_THRESHOLD_DEFAULT, SEARCH_RADIUS_M_DEFAULT,
)

logger = logging.getLogger("mapniti.impact")

OPEN_BUILDINGS_ASSET = "GOOGLE/Research/open-buildings/v3/polygons"

DEFAULT_CONFIDENCE = 0.75
MAX_BUILDINGS_EVALUATED = 20000
MAX_AFFECTED_LISTED = 300
MAX_ROAD_WAYS = 5000
MAX_BUILDINGS_FOR_3D = 3000  # cap on returning actual per-building GeoJSON+height for extrusion rendering


def _buildings_fc(roi, confidence):
    return (
        ee.FeatureCollection(OPEN_BUILDINGS_ASSET)
        .filterBounds(roi)
        .filter(ee.Filter.gte("confidence", confidence))
    )


def _estimate_building_heights(buildings, roi):
    """
    Approximate per-building height via nDSM (surface model minus bare-
    earth elevation): Open Buildings v3 has no native height field, so
    ALOS AW3D30 (a DSM — includes rooftops/canopy) minus SRTM (a DTM-ish
    bare-earth product) gives a rough height estimate. Uses only DEM
    sources already relied on elsewhere in this app — no new dataset risk.
    Returns a FeatureCollection with height_m added, or None on failure.
    """
    try:
        dsm = get_dem_image("ALOS", roi)
        dtm = get_dem_image("SRTM", roi)
        ndsm = dsm.subtract(dtm).max(0).rename("height_m")
        # For a single-band image, reduceRegions names the output property
        # after the REDUCER ("mean"), not the band name — unlike the
        # multi-band case elsewhere in this file, where band names win.
        # setOutputs() pins the property name explicitly so it's unambiguous.
        reducer = ee.Reducer.mean().setOutputs(["height_m"])
        return ndsm.reduceRegions(collection=buildings, reducer=reducer, scale=10, tileScale=4)
    except Exception:
        logger.warning("Building height (nDSM) estimation failed, continuing without it.", exc_info=True)
        return None


def get_buildings(data: dict) -> dict:
    """
    Fetches building footprints for the AOI as a styled tile layer + full
    GeoJSON download. When the count is small enough (<= MAX_BUILDINGS_FOR_3D),
    also returns the actual per-building GeoJSON with an nDSM-estimated
    height_m property, so the frontend can render real 3D extrusions
    instead of just the flat overview tile.
    """
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        return {"status": "error", "message": "No ROI (geometry) provided"}

    try:
        confidence = float(data.get("confidence", DEFAULT_CONFIDENCE))
        buildings = _buildings_fc(roi, confidence).limit(MAX_BUILDINGS_EVALUATED)

        count = buildings.size().getInfo()
        styled = buildings.style(color="1e293b", fillColor="1e293b66", width=1)
        map_id = styled.getMapId()

        features_geojson = None
        if 0 < count <= MAX_BUILDINGS_FOR_3D:
            with_height = _estimate_building_heights(buildings, roi)
            if with_height is not None:
                features_geojson = with_height.getInfo()

        return {
            "status": "success",
            "layers": [{
                "layerId": "buildings",
                "name": "Buildings (Google Open Buildings)",
                "visual_url": map_id["tile_fetcher"].url_format,
                "download_url": buildings.getDownloadURL("geojson"),
                "recolorable": False,
            }],
            "building_count": count,
            "building_count_capped": count >= MAX_BUILDINGS_EVALUATED,
            "features": features_geojson,
            "features_available": 0 < count <= MAX_BUILDINGS_FOR_3D,
        }
    except Exception as exc:
        logger.exception("get_buildings failed")
        return {"status": "error", "message": str(exc)}


def analyze_uploaded_buildings(data: dict) -> dict:
    """
    Same zonal-stats flood-exposure analysis as analyze_building_impact,
    but against a user-uploaded building FeatureCollection (their own
    footprints — which can already carry real height/attribute data, e.g.
    from a municipal survey) instead of Google Open Buildings.
    """
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        return {"status": "error", "message": "No ROI (geometry) provided"}

    try:
        stage_m = data.get("stage_m")
        if stage_m is None:
            return {"status": "error", "message": "stage_m is required (from the Run Inundation step)."}
        stage_m = float(stage_m)
        affected_threshold = float(data.get("affected_threshold", 0.0))

        uploaded = data.get("buildings_geojson")
        upload_features = (uploaded or {}).get("features") or []
        if not upload_features:
            return {"status": "error", "message": "No uploaded buildings provided."}

        dem_source = data.get("dem_source", "SRTM")
        stream_threshold = data.get("stream_threshold", STREAM_THRESHOLD_DEFAULT)
        search_radius_m = data.get("search_radius_m", SEARCH_RADIUS_M_DEFAULT)

        _, hand, _, _ = _hand_and_streams(roi, dem_source, stream_threshold, search_radius_m)
        # unmask(0): outside HAND's search radius, treat as definitely not
        # flooded rather than null (see analyze_building_impact for the
        # crash this avoided there).
        flood_extent = hand.lte(stage_m).unmask(0).rename("flood_fraction")
        depth_grid = ee.Image.constant(stage_m).subtract(hand).max(0).unmask(0).rename("depth")

        capped_features = upload_features[:MAX_BUILDINGS_EVALUATED]
        for i, feat in enumerate(capped_features):
            feat.setdefault("properties", {})
            feat["properties"]["_upload_id"] = i
        fc = ee.FeatureCollection(capped_features)

        zonal_img = ee.Image.cat([flood_extent, depth_grid])
        stats = zonal_img.reduceRegions(collection=fc, reducer=ee.Reducer.mean(), scale=10, tileScale=4)
        info = stats.getInfo()

        out_features = []
        affected_count = 0
        for feat in info.get("features", []):
            props = feat.get("properties", {}) or {}
            flood_fraction = props.get("flood_fraction") or 0
            is_affected = flood_fraction > affected_threshold
            props["affected"] = is_affected
            props["flood_fraction"] = round(flood_fraction, 3)
            props["depth_m"] = round(props.get("depth") or 0, 2)
            if is_affected:
                affected_count += 1
            out_features.append({
                "type": "Feature", "id": feat.get("id"),
                "properties": props, "geometry": feat.get("geometry"),
            })

        total = len(out_features)
        return {
            "status": "success",
            "summary": {
                "total_buildings_analyzed": total,
                "affected_buildings": affected_count,
                "affected_percentage": round((affected_count / total) * 100, 1) if total else 0,
                "water_surface_stage_m": stage_m,
                "upload_truncated": len(upload_features) > MAX_BUILDINGS_EVALUATED,
            },
            "geojson": {"type": "FeatureCollection", "features": out_features},
        }
    except Exception as exc:
        logger.exception("analyze_uploaded_buildings failed")
        return {"status": "error", "message": str(exc)}


def _fetch_osm_roads(bbox: dict) -> dict:
    south, west, north, east = bbox["south"], bbox["west"], bbox["north"], bbox["east"]
    query = (
        "[out:json][timeout:25];"
        f"(way[\"highway\"]({south},{west},{north},{east}););"
        "out body geom;"
    )
    # Shared helper: tries several public Overpass servers, since any one of them is often busy.
    from app.services.analysis_engine import overpass  # local import avoids a circular import at load time
    result = overpass(query, timeout=90)

    elements = result.get("elements", [])
    truncated = len(elements) > MAX_ROAD_WAYS
    elements = elements[:MAX_ROAD_WAYS]

    features = []
    for el in elements:
        if el.get("type") != "way" or not el.get("geometry"):
            continue
        coords = [[pt["lon"], pt["lat"]] for pt in el["geometry"]]
        if len(coords) < 2:
            continue
        tags = el.get("tags", {})
        features.append({
            "type": "Feature",
            "properties": {"osm_id": el.get("id"), "highway": tags.get("highway"), "name": tags.get("name")},
            "geometry": {"type": "LineString", "coordinates": coords},
        })

    return {"type": "FeatureCollection", "features": features}, truncated


def get_roads(data: dict) -> dict:
    """Fetches OSM road centrelines for a bounding box as raw GeoJSON (rendered client-side)."""
    bbox = data.get("bbox")
    if not bbox:
        return {"status": "error", "message": "No bbox provided"}

    try:
        geojson, truncated = _fetch_osm_roads(bbox)
        return {
            "status": "success",
            "geojson": geojson,
            "road_count": len(geojson["features"]),
            "road_count_truncated": truncated,
        }
    except Exception as exc:
        logger.exception("get_roads failed")
        return {"status": "error", "message": f"Could not fetch OSM roads: {exc}"}


def analyze_building_impact(data: dict) -> dict:
    """
    Zonal-statistics exposure analysis: for every building footprint,
    computes the fraction of its area within the flood extent and the
    average water depth, and auto-tags each one with "affected" (bool),
    "flood_fraction" and "depth_m" attributes — the same attributes are
    included in the downloadable GeoJSON.
    """
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        return {"status": "error", "message": "No ROI (geometry) provided"}

    try:
        stage_m = data.get("stage_m")
        if stage_m is None:
            return {"status": "error", "message": "stage_m is required (from the Run Inundation step)."}
        stage_m = float(stage_m)
        confidence = float(data.get("confidence", DEFAULT_CONFIDENCE))
        affected_threshold = float(data.get("affected_threshold", 0.0))

        dem_source = data.get("dem_source", "SRTM")
        stream_threshold = data.get("stream_threshold", STREAM_THRESHOLD_DEFAULT)
        search_radius_m = data.get("search_radius_m", SEARCH_RADIUS_M_DEFAULT)

        _, hand, _, _ = _hand_and_streams(roi, dem_source, stream_threshold, search_radius_m)
        # unmask(0): outside HAND's search radius (no stream found nearby),
        # treat a building as definitely not flooded rather than "unknown" —
        # a masked/null flood_fraction crashed ee.Number.gt() during the
        # reduceRegions below for any building that landed entirely outside
        # HAND's valid extent.
        flood_extent = hand.lte(stage_m).unmask(0).rename("flood_fraction")
        # Footprint-averaged depth (dry portions of a partly-flooded building
        # contribute 0), not the depth-if-flooded — a simplification worth
        # noting since it dilutes the reported value for large/edge buildings.
        depth_grid = ee.Image.constant(stage_m).subtract(hand).max(0).unmask(0).rename("depth")

        buildings = _buildings_fc(roi, confidence).limit(MAX_BUILDINGS_EVALUATED)
        total_buildings = buildings.size().getInfo()

        zonal_img = ee.Image.cat([flood_extent, depth_grid])
        stats = zonal_img.reduceRegions(
            collection=buildings, reducer=ee.Reducer.mean(), scale=10, tileScale=4,
        )
        stats = stats.map(lambda f: f.set("affected", ee.Number(f.get("flood_fraction")).gt(affected_threshold)))

        affected = stats.filter(ee.Filter.gt("flood_fraction", affected_threshold))
        affected_count = affected.size().getInfo()

        affected_area = affected.aggregate_sum("area_in_meters").getInfo() or 0
        total_area = buildings.aggregate_sum("area_in_meters").getInfo() or 0

        affected_styled = affected.style(color="dc2626", fillColor="dc2626aa", width=1)
        affected_map_id = affected_styled.getMapId()

        def _centroid_of(geom):
            try:
                if geom and geom.get("type") == "Polygon":
                    ring = geom["coordinates"][0]
                    return {"lon": sum(p[0] for p in ring) / len(ring), "lat": sum(p[1] for p in ring) / len(ring)}
            except Exception:
                pass
            return None

        # When the building set is small enough, pull the FULL per-building
        # result once (affected + unaffected) instead of a second, separate
        # affected-only query: this lets the frontend recolor the 3D
        # extrusion layer it already fetched from get_buildings() by actual
        # affected status, instead of it staying a single flat colour.
        all_buildings_features = None
        if total_buildings <= MAX_BUILDINGS_FOR_3D:
            full_info = stats.getInfo()
            out_features = []
            affected_list = []
            for feat in full_info.get("features", []):
                props = feat.get("properties", {}) or {}
                flood_fraction = props.get("flood_fraction") or 0
                props["flood_fraction"] = round(flood_fraction, 3)
                props["depth_m"] = round(props.get("depth") or 0, 2)
                props["affected"] = flood_fraction > affected_threshold
                geom = feat.get("geometry")
                out_features.append({"type": "Feature", "id": feat.get("id"), "properties": props, "geometry": geom})
                if props["affected"] and len(affected_list) < MAX_AFFECTED_LISTED:
                    affected_list.append({
                        "id": feat.get("id"),
                        "area_m2": round(props.get("area_in_meters", 0), 1),
                        "confidence": round(props.get("confidence", 0), 2),
                        "flood_fraction": props["flood_fraction"],
                        "depth_m": props["depth_m"],
                        "centroid": _centroid_of(geom),
                    })
            all_buildings_features = {"type": "FeatureCollection", "features": out_features}
        else:
            listed_info = affected.limit(MAX_AFFECTED_LISTED).getInfo()
            affected_list = []
            for feat in listed_info.get("features", []):
                props = feat.get("properties", {})
                affected_list.append({
                    "id": feat.get("id"),
                    "area_m2": round(props.get("area_in_meters", 0), 1),
                    "confidence": round(props.get("confidence", 0), 2),
                    "flood_fraction": round(props.get("flood_fraction", 0), 2),
                    "depth_m": round(props.get("depth", 0), 2),
                    "centroid": _centroid_of(feat.get("geometry")),
                })

        return {
            "status": "success",
            "layers": [{
                "layerId": "affected_buildings",
                "name": "Affected Buildings",
                "visual_url": affected_map_id["tile_fetcher"].url_format,
                "download_url": affected.getDownloadURL("geojson"),
                "recolorable": False,
            }],
            "summary": {
                "total_buildings_analyzed": total_buildings,
                "buildings_capped": total_buildings >= MAX_BUILDINGS_EVALUATED,
                "affected_buildings": affected_count,
                "affected_percentage": round((affected_count / total_buildings) * 100, 1) if total_buildings else 0,
                "affected_building_area_m2": round(affected_area, 1),
                "total_building_area_m2": round(total_area, 1),
                "water_surface_stage_m": stage_m,
            },
            "affected_buildings": affected_list,
            "affected_buildings_truncated": affected_count > MAX_AFFECTED_LISTED,
            "all_buildings_download_url": buildings.getDownloadURL("geojson"),
            "all_buildings_features": all_buildings_features,
        }
    except Exception as exc:
        logger.exception("analyze_building_impact failed")
        return {"status": "error", "message": str(exc)}
