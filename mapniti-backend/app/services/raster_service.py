"""
Raster Analysis Engine
=======================
Spectral indices (NDVI/NDWI/NDBI), a generic band-math calculator, and
LULC (Land Use / Land Cover) classification — all backed by Google Earth
Engine. The API route file (raster.py) is just a thin wrapper around
these functions.

Reuses init_earth_engine()/get_roi() from hydrology_engine rather than
duplicating GEE bootstrap logic.
"""
import logging
import ee
from app.services.hydrology_engine import init_earth_engine, get_roi

logger = logging.getLogger("mapniti.raster")

FEATURE_BANDS = ["RED", "GREEN", "BLUE", "NIR", "SWIR1", "SWIR2"]

SOURCE_LABELS = {
    "SENTINEL2": "Sentinel-2",
    "LANDSAT8": "Landsat 8",
    "LANDSAT9": "Landsat 9",
}


def _mask_s2_clouds(img):
    qa = img.select("QA60")
    cloud_bit_mask = 1 << 10
    cirrus_bit_mask = 1 << 11
    mask = qa.bitwiseAnd(cloud_bit_mask).eq(0).And(qa.bitwiseAnd(cirrus_bit_mask).eq(0))
    return img.updateMask(mask)


def _mask_landsat_clouds(img):
    qa = img.select("QA_PIXEL")
    cloud_shadow_bit_mask = 1 << 4
    cloud_bit_mask = 1 << 3
    mask = qa.bitwiseAnd(cloud_shadow_bit_mask).eq(0).And(qa.bitwiseAnd(cloud_bit_mask).eq(0))
    optical_bands = img.select("SR_B.").multiply(0.0000275).add(-0.2)
    return img.addBands(optical_bands, None, True).updateMask(mask)


# Supported optical imagery sources — real, verified Google Earth Engine datasets
IMAGERY_SOURCES = {
    "SENTINEL2": {
        "collection": "COPERNICUS/S2_SR_HARMONIZED",
        "scale": 10,
        "cloud_property": "CLOUDY_PIXEL_PERCENTAGE",
        "cloud_mask_fn": _mask_s2_clouds,
        "bands": {"BLUE": "B2", "GREEN": "B3", "RED": "B4", "NIR": "B8", "SWIR1": "B11", "SWIR2": "B12"},
        "rgb_vis": {"min": 0, "max": 3000},
    },
    "LANDSAT8": {
        "collection": "LANDSAT/LC08/C02/T1_L2",
        "scale": 30,
        "cloud_property": "CLOUD_COVER",
        "cloud_mask_fn": _mask_landsat_clouds,
        "bands": {"BLUE": "SR_B2", "GREEN": "SR_B3", "RED": "SR_B4", "NIR": "SR_B5", "SWIR1": "SR_B6", "SWIR2": "SR_B7"},
        "rgb_vis": {"min": 0, "max": 0.3},
    },
    "LANDSAT9": {
        "collection": "LANDSAT/LC09/C02/T1_L2",
        "scale": 30,
        "cloud_property": "CLOUD_COVER",
        "cloud_mask_fn": _mask_landsat_clouds,
        "bands": {"BLUE": "SR_B2", "GREEN": "SR_B3", "RED": "SR_B4", "NIR": "SR_B5", "SWIR1": "SR_B6", "SWIR2": "SR_B7"},
        "rgb_vis": {"min": 0, "max": 0.3},
    },
}


def _get_optical_composite(source_key, roi, start_date, end_date, max_cloud_cover):
    """
    Cloud-masked, cloud-cover-filtered median composite, with bands renamed
    to the shared RED/GREEN/BLUE/NIR/SWIR1/SWIR2 aliases so every tool below
    can work with any imagery source interchangeably.

    Returns (image, scale) or (None, scale) if nothing matched the filters.
    """
    source = IMAGERY_SOURCES.get(source_key, IMAGERY_SOURCES["SENTINEL2"])
    collection = (
        ee.ImageCollection(source["collection"])
        .filterBounds(roi)
        .filterDate(start_date, end_date)
        .filter(ee.Filter.lt(source["cloud_property"], max_cloud_cover))
        .map(source["cloud_mask_fn"])
    )

    count = collection.size().getInfo()
    if count == 0:
        return None, source["scale"]

    composite = collection.median().clip(roi)
    renamed = composite.select(list(source["bands"].values()), list(source["bands"].keys()))
    return renamed, source["scale"]


def _read_common_params(data):
    """Shared imagery-source/date/cloud-cover params used by every tool below."""
    source_key = data.get("imagery_source", "SENTINEL2")
    start_date = data.get("start_date")
    end_date = data.get("end_date")
    max_cloud_cover = float(data.get("max_cloud_cover", 20))
    return source_key, start_date, end_date, max_cloud_cover


def _get_tif_download_url(image, roi, scale):
    """Real GeoTIFF download (replaces the old PNG-thumbnail download links)."""
    try:
        return image.getDownloadURL({"region": roi, "scale": scale, "format": "GEO_TIFF", "crs": "EPSG:4326"})
    except Exception:
        logger.warning("GeoTIFF download URL generation failed for a layer.", exc_info=True)
        return None


# Named gradient ramps a result layer can be recolored with (ArcGIS-Pro-style
# symbology switching). "default" per tool is defined alongside each tool below.
PALETTE_PRESETS = {
    "spectral": ["#9e0142", "#d53e4f", "#f46d43", "#fdae61", "#fee08b", "#ffffbf", "#e6f598", "#abdda4", "#66c2a5", "#3288bd", "#5e4fa2"],
    "ndvi_classic": ["#a52a2a", "#d2b48c", "#ffff99", "#9acd32", "#228b22", "#006400"],
    "blues": ["#f7fbff", "#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#08519c", "#08306b"],
    "viridis": ["#440154", "#472d7b", "#3b528b", "#2c728e", "#21918c", "#28ae80", "#5ec962", "#addc30", "#fde725"],
    "grayscale": ["#000000", "#404040", "#808080", "#bfbfbf", "#ffffff"],
}


def _resolve_palette(data, default_palette):
    palette_name = data.get("palette")
    if palette_name and palette_name != "default" and palette_name in PALETTE_PRESETS:
        return PALETTE_PRESETS[palette_name]
    return default_palette


CLASS_PALETTE = [
    "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231",
    "#911eb4", "#46f0f0", "#f032e6", "#bcf60c", "#fabebe",
]


def _assign_colors(labels, provided_colors=None):
    provided_colors = provided_colors or {}
    return [provided_colors.get(label) or CLASS_PALETTE[i % len(CLASS_PALETTE)] for i, label in enumerate(labels)]


def _grouped_area_km2(classified_image, class_meta, roi, scale):
    """
    class_meta: list of {"class_id": int, "label": str, "color": str}
    Returns class_meta entries augmented with area_km2 (0 for classes with no pixels).
    """
    pixel_area = ee.Image.pixelArea().divide(1_000_000).rename("area")
    combined = pixel_area.addBands(classified_image.rename("class"))
    grouped = combined.reduceRegion(
        reducer=ee.Reducer.sum().group(1, "class"),
        geometry=roi,
        scale=scale,
        maxPixels=1e10,
        bestEffort=True,
    )
    groups = grouped.get("groups").getInfo() or []
    area_by_class = {int(g["class"]): g["sum"] for g in groups}
    return [{**entry, "area_km2": round(area_by_class.get(entry["class_id"], 0) or 0, 3)} for entry in class_meta]


# ============================================================
# Spectral indices — NDVI / NDWI / NDBI
# ============================================================

INDEX_CONFIG = {
    "NDVI": {
        "bands": ("NIR", "RED"),
        "min": -0.2, "max": 0.8,
        "palette": ["#a50026", "#d73027", "#f46d43", "#fdae61", "#fee08b", "#ffffbf", "#d9ef8b", "#a6d96a", "#66bd63", "#1a9850", "#006837"],
    },
    "NDWI": {
        "bands": ("GREEN", "NIR"),
        "min": -0.5, "max": 0.5,
        "palette": ["#8c510a", "#d8b365", "#f6e8c3", "#f5f5f5", "#c7eae5", "#5ab4ac", "#01665e"],
    },
    "NDBI": {
        "bands": ("SWIR1", "NIR"),
        "min": -0.5, "max": 0.5,
        "palette": ["#006837", "#a6d96a", "#ffffbf", "#fdae61", "#d73027"],
    },
}


def compute_spectral_index(data: dict) -> dict:
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        return {"status": "error", "message": "No ROI (geometry) provided"}

    index_type = (data.get("index_type") or "NDVI").upper()
    config = INDEX_CONFIG.get(index_type)
    if not config:
        return {"status": "error", "message": f"Unknown index type: {index_type}"}

    source_key, start_date, end_date, max_cloud_cover = _read_common_params(data)
    if not start_date or not end_date:
        return {"status": "error", "message": "start_date and end_date are required"}

    try:
        composite, scale = _get_optical_composite(source_key, roi, start_date, end_date, max_cloud_cover)
        if composite is None:
            return {"status": "error", "message": "No cloud-free imagery found for that source/date range. Try widening the date range or increasing max cloud cover."}

        band_a, band_b = config["bands"]
        index_image = composite.normalizedDifference([band_a, band_b]).rename(index_type)

        palette = _resolve_palette(data, config["palette"])
        vis_params = {"min": config["min"], "max": config["max"], "palette": palette}
        map_id = index_image.getMapId(vis_params)
        download_url = _get_tif_download_url(index_image, roi, scale)

        mean_result = index_image.reduceRegion(reducer=ee.Reducer.mean(), geometry=roi, scale=scale, maxPixels=1e10, bestEffort=True)
        mean_value = mean_result.get(index_type).getInfo()

        return {
            "status": "success",
            "layers": [{
                "layerId": index_type.lower(),
                "name": f"{index_type} ({SOURCE_LABELS.get(source_key, source_key)})",
                "visual_url": map_id["tile_fetcher"].url_format,
                "download_url": download_url,
            }],
            "stats": {"mean_value": round(mean_value, 4) if mean_value is not None else None},
        }
    except Exception as exc:
        logger.exception("compute_spectral_index failed")
        return {"status": "error", "message": str(exc)}


# ============================================================
# Raster Calculator — custom band-math expression
# ============================================================

def compute_custom_expression(data: dict) -> dict:
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        return {"status": "error", "message": "No ROI (geometry) provided"}

    expression = (data.get("expression") or "").strip()
    if not expression:
        return {"status": "error", "message": "A band-math expression is required, e.g. (NIR-RED)/(NIR+RED)"}

    source_key, start_date, end_date, max_cloud_cover = _read_common_params(data)
    if not start_date or not end_date:
        return {"status": "error", "message": "start_date and end_date are required"}

    try:
        composite, scale = _get_optical_composite(source_key, roi, start_date, end_date, max_cloud_cover)
        if composite is None:
            return {"status": "error", "message": "No cloud-free imagery found for that source/date range. Try widening the date range or increasing max cloud cover."}

        band_vars = {name: composite.select(name) for name in FEATURE_BANDS}
        result_image = composite.expression(expression, band_vars).rename("result")

        stats = result_image.reduceRegion(
            reducer=ee.Reducer.minMax(), geometry=roi, scale=scale, maxPixels=1e10, bestEffort=True
        ).getInfo()
        result_min = stats.get("result_min")
        result_max = stats.get("result_max")
        if result_min is None or result_max is None:
            return {"status": "error", "message": "The expression produced no valid pixels over this area — check the band names and expression."}

        default_palette = ["#313695", "#4575b4", "#74add1", "#abd9e9", "#e0f3f8", "#ffffbf", "#fee090", "#fdae61", "#f46d43", "#d73027", "#a50026"]
        vis_params = {"min": result_min, "max": result_max, "palette": _resolve_palette(data, default_palette)}
        map_id = result_image.getMapId(vis_params)
        download_url = _get_tif_download_url(result_image, roi, scale)

        return {
            "status": "success",
            "layers": [{
                "layerId": "custom_calc",
                "name": f"Raster Calculator: {expression}",
                "visual_url": map_id["tile_fetcher"].url_format,
                "download_url": download_url,
            }],
            "stats": {"min_value": round(result_min, 4), "max_value": round(result_max, 4)},
        }
    except Exception as exc:
        logger.exception("compute_custom_expression failed")
        return {"status": "error", "message": f"Invalid expression or computation failed: {exc}"}


# ============================================================
# Preview imagery — true-color composite, shown on the map before the user
# places supervised-classification training samples on top of it.
# ============================================================

def preview_composite(data: dict) -> dict:
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        return {"status": "error", "message": "No ROI (geometry) provided"}

    source_key, start_date, end_date, max_cloud_cover = _read_common_params(data)
    if not start_date or not end_date:
        return {"status": "error", "message": "start_date and end_date are required"}

    try:
        composite, scale = _get_optical_composite(source_key, roi, start_date, end_date, max_cloud_cover)
        if composite is None:
            return {"status": "error", "message": "No cloud-free imagery found for that source/date range. Try widening the date range or increasing max cloud cover."}

        rgb_vis = IMAGERY_SOURCES.get(source_key, IMAGERY_SOURCES["SENTINEL2"])["rgb_vis"]
        vis_params = {"bands": ["RED", "GREEN", "BLUE"], **rgb_vis}
        map_id = composite.getMapId(vis_params)

        return {
            "status": "success",
            "layers": [{
                "layerId": "preview",
                "name": f"Preview Imagery ({SOURCE_LABELS.get(source_key, source_key)})",
                "visual_url": map_id["tile_fetcher"].url_format,
            }],
        }
    except Exception as exc:
        logger.exception("preview_composite failed")
        return {"status": "error", "message": str(exc)}


# ============================================================
# LULC — Supervised classification
# ============================================================

def run_supervised_classification(data: dict) -> dict:
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        return {"status": "error", "message": "No ROI (geometry) provided"}

    training_geojson = data.get("training_geojson")
    if not training_geojson or not training_geojson.get("features"):
        return {"status": "error", "message": "A labeled training-samples GeoJSON (points/polygons with a class_name property) is required."}

    source_key, start_date, end_date, max_cloud_cover = _read_common_params(data)
    if not start_date or not end_date:
        return {"status": "error", "message": "start_date and end_date are required"}

    try:
        class_order = []
        samples_by_class = {}
        colors_by_class = {}
        for feature in training_geojson["features"]:
            props = feature.get("properties") or {}
            class_name = props.get("class_name")
            if not class_name or not feature.get("geometry"):
                continue
            if class_name not in samples_by_class:
                samples_by_class[class_name] = []
                class_order.append(class_name)
            if props.get("color") and class_name not in colors_by_class:
                colors_by_class[class_name] = props["color"]
            samples_by_class[class_name].append(feature)

        if len(class_order) < 2:
            return {"status": "error", "message": "At least 2 land-cover classes are required for supervised classification."}
        for class_name in class_order:
            if len(samples_by_class[class_name]) < 5:
                return {"status": "error", "message": f"Class '{class_name}' has only {len(samples_by_class[class_name])} sample(s) — at least 5 are required per class."}

        class_ids = {name: idx + 1 for idx, name in enumerate(class_order)}
        colors = _assign_colors(class_order, colors_by_class)

        ee_features = []
        for class_name in class_order:
            for feature in samples_by_class[class_name]:
                ee_features.append(ee.Feature(ee.Geometry(feature["geometry"]), {"class": class_ids[class_name]}))
        training_fc = ee.FeatureCollection(ee_features)

        composite, scale = _get_optical_composite(source_key, roi, start_date, end_date, max_cloud_cover)
        if composite is None:
            return {"status": "error", "message": "No cloud-free imagery found for that source/date range. Try widening the date range or increasing max cloud cover."}

        feature_image = composite.select(FEATURE_BANDS)
        training_samples = feature_image.sampleRegions(
            collection=training_fc, properties=["class"], scale=scale, tileScale=4
        )

        classifier = ee.Classifier.smileRandomForest(50).train(
            features=training_samples, classProperty="class", inputProperties=FEATURE_BANDS
        )
        classified = feature_image.classify(classifier).rename("class")

        vis_params = {"min": 1, "max": len(class_order), "palette": colors}
        map_id = classified.getMapId(vis_params)
        download_url = _get_tif_download_url(classified, roi, scale)

        class_meta = [{"class_id": class_ids[name], "label": name, "color": colors[i]} for i, name in enumerate(class_order)]
        legend = _grouped_area_km2(classified, class_meta, roi, scale)

        return {
            "status": "success",
            "layers": [{
                "layerId": "lulc_supervised",
                "name": f"LULC — Supervised Classification ({SOURCE_LABELS.get(source_key, source_key)})",
                "visual_url": map_id["tile_fetcher"].url_format,
                "download_url": download_url,
            }],
            "legend": legend,
        }
    except Exception as exc:
        logger.exception("run_supervised_classification failed")
        return {"status": "error", "message": str(exc)}


# ============================================================
# LULC — Unsupervised classification
# ============================================================

def run_unsupervised_classification(data: dict) -> dict:
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        return {"status": "error", "message": "No ROI (geometry) provided"}

    source_key, start_date, end_date, max_cloud_cover = _read_common_params(data)
    if not start_date or not end_date:
        return {"status": "error", "message": "start_date and end_date are required"}

    try:
        num_clusters = int(data.get("num_clusters", 5))
        num_clusters = max(2, min(10, num_clusters))

        composite, scale = _get_optical_composite(source_key, roi, start_date, end_date, max_cloud_cover)
        if composite is None:
            return {"status": "error", "message": "No cloud-free imagery found for that source/date range. Try widening the date range or increasing max cloud cover."}

        feature_image = composite.select(FEATURE_BANDS)
        training = feature_image.sample(region=roi, scale=scale, numPixels=5000, tileScale=4)

        clusterer = ee.Clusterer.wekaKMeans(num_clusters).train(training)
        # Clusterer output cluster ids are 0-based; shift to 1-based for the shared area helper
        classified = feature_image.cluster(clusterer).add(1).rename("class")

        class_order = [f"Cluster {i + 1}" for i in range(num_clusters)]
        colors = _assign_colors(class_order)

        vis_params = {"min": 1, "max": num_clusters, "palette": colors}
        map_id = classified.getMapId(vis_params)
        download_url = _get_tif_download_url(classified, roi, scale)

        class_meta = [{"class_id": i + 1, "label": class_order[i], "color": colors[i]} for i in range(num_clusters)]
        legend = _grouped_area_km2(classified, class_meta, roi, scale)

        return {
            "status": "success",
            "layers": [{
                "layerId": "lulc_unsupervised",
                "name": f"LULC — Unsupervised Classification ({SOURCE_LABELS.get(source_key, source_key)}, k={num_clusters})",
                "visual_url": map_id["tile_fetcher"].url_format,
                "download_url": download_url,
            }],
            "legend": legend,
        }
    except Exception as exc:
        logger.exception("run_unsupervised_classification failed")
        return {"status": "error", "message": str(exc)}


# ============================================================
# LULC — Pre-classified (ESA WorldCover 10m, ready-made global land cover)
# ============================================================

WORLDCOVER_CLASSES = [
    {"class_id": 10, "label": "Tree Cover", "color": "#006400"},
    {"class_id": 20, "label": "Shrubland", "color": "#ffbb22"},
    {"class_id": 30, "label": "Grassland", "color": "#ffff4c"},
    {"class_id": 40, "label": "Cropland", "color": "#f096ff"},
    {"class_id": 50, "label": "Built-up", "color": "#fa0000"},
    {"class_id": 60, "label": "Bare / Sparse Vegetation", "color": "#b4b4b4"},
    {"class_id": 70, "label": "Snow and Ice", "color": "#f0f0f0"},
    {"class_id": 80, "label": "Permanent Water Bodies", "color": "#0064c8"},
    {"class_id": 90, "label": "Herbaceous Wetland", "color": "#0096a0"},
    {"class_id": 95, "label": "Mangroves", "color": "#00cf75"},
    {"class_id": 100, "label": "Moss and Lichen", "color": "#fae6a0"},
]
WORLDCOVER_ASSETS = {2020: "ESA/WorldCover/v100/2020", 2021: "ESA/WorldCover/v200/2021"}


def run_preclassified_lulc(data: dict) -> dict:
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        return {"status": "error", "message": "No ROI (geometry) provided"}

    try:
        year = int(data.get("year", 2021))
        asset_id = WORLDCOVER_ASSETS.get(year)
        if not asset_id:
            return {"status": "error", "message": f"Pre-classified land cover is only available for years: {sorted(WORLDCOVER_ASSETS.keys())}."}

        image = ee.Image(asset_id).select("Map").clip(roi)
        scale = 10

        vis_params = {
            "min": WORLDCOVER_CLASSES[0]["class_id"],
            "max": WORLDCOVER_CLASSES[-1]["class_id"],
            "palette": [c["color"] for c in WORLDCOVER_CLASSES],
        }
        map_id = image.getMapId(vis_params)
        download_url = _get_tif_download_url(image, roi, scale)

        legend = _grouped_area_km2(image, WORLDCOVER_CLASSES, roi, scale)

        return {
            "status": "success",
            "layers": [{
                "layerId": "lulc_preclassified",
                "name": f"LULC — Pre-classified Land Cover (ESA WorldCover {year})",
                "visual_url": map_id["tile_fetcher"].url_format,
                "download_url": download_url,
            }],
            "legend": legend,
        }
    except Exception as exc:
        logger.exception("run_preclassified_lulc failed")
        return {"status": "error", "message": str(exc)}
