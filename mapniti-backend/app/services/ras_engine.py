"""
HEC-RAS-equivalent Hydraulic Engine
=====================================
Reproduces the standard low-complexity alternative to a full HEC-RAS
1D/2D hydraulic model: the HAND (Height Above Nearest Drainage) terrain
index combined with a Manning's-equation Synthetic Rating Curve
(HAND-SRC) — the same approach used by NOAA's operational inundation
mapping service and validated against HEC-RAS 2D in the flood-mapping
literature (e.g. Zheng et al., "Real-Time Flood Mapping ... Using HAND
Model", 2021; Liu et al. on HAND-SRC vs hydrodynamic models).

HAND here is an approximation: rather than a true D8-routed vertical
drop to the hydrologically-connected drainage cell (which needs a full
flow-direction trace — impractical to run reliably inside a stateless
GEE request), each pixel's "nearest drainage elevation" is the minimum
elevation of any stream cell within a fixed search radius. This is a
standard simplified proxy documented as such; it is accurate near the
channel and coarser far from it.

All GEE geoprocessing logic lives here, mirroring hydrology_engine.py.
"""
import logging
import numpy as np
import ee
from app.services.hydrology_engine import init_earth_engine, get_roi, get_dem_image, _get_geotiff_url, worldpop_image, WORLDPOP_SCALE

logger = logging.getLogger("mapniti.ras")

STREAM_THRESHOLD_DEFAULT = 500
SEARCH_RADIUS_M_DEFAULT = 3000
SCALE_M_DEFAULT = 90

# Manning's roughness coefficient by ESA WorldCover v200 class — typical
# textbook values (Chow, "Open-Channel Hydraulics").
WORLDCOVER_MANNING_N = {
    10: 0.10,  # Tree cover
    20: 0.07,  # Shrubland
    30: 0.035,  # Grassland
    40: 0.035,  # Cropland
    50: 0.015,  # Built-up
    60: 0.03,  # Bare / sparse vegetation
    70: 0.03,  # Snow / ice
    80: 0.03,  # Permanent water
    90: 0.06,  # Herbaceous wetland
    95: 0.10,  # Mangroves
    100: 0.05,  # Moss / lichen
}


def _pick_analysis_scale(roi, target_samples_per_side=100, min_scale=10, max_scale=SCALE_M_DEFAULT):
    """
    Chooses a reduceRegion/kernel sampling scale sized to the AOI, instead
    of a single fixed 90m for everything. A modest river-corridor study
    area (the natural size for a buildings/roads impact study) needs a
    much finer grid than 90m to resolve the near-channel flood zone at low
    stages — at 90m a 700x500m AOI only has a handful of sample points,
    so low-stage flooding fell between them entirely and the rating curve
    stair-stepped to zero. A basin-scale AOI, by contrast, should stay
    coarse for performance. Bounded to [min_scale, max_scale] meters.
    """
    area_m2 = roi.area(1).getInfo()
    side_m = area_m2 ** 0.5
    scale = side_m / target_samples_per_side
    return max(min_scale, min(max_scale, scale))


def _hand_and_streams(roi, dem_source, stream_threshold, search_radius_m):
    scale = _pick_analysis_scale(roi)

    # Search for stream cells over a BUFFERED region, not just the drawn
    # AOI: for a modest river-corridor study area (the natural size for a
    # building-impact study, as opposed to a whole basin), the nearest
    # HydroSHEDS stream pixel can easily fall just outside the polygon —
    # clipping the search to the AOI left HAND fully masked in that case,
    # which silently made every building come back "unaffected".
    search_roi = roi.buffer(search_radius_m)
    dem_search = get_dem_image(dem_source, search_roi)
    accumulation = ee.Image("WWF/HydroSHEDS/15ACC").select("b1").clip(search_roi)
    streams_mask = accumulation.gt(stream_threshold)

    stream_elev = dem_search.updateMask(streams_mask).unmask(99999)
    # Reproject onto a fixed working grid before the focal filter. Without
    # this, a units="meters" kernel is sized against the image's native
    # projection (often much finer than intended), which blows past GEE's
    # 512-pixel kernel-size limit for realistic search radii — e.g.
    # search_radius_m=3000 raised a "Kernel is too large: 601 pixels" error.
    #
    # This scale is deliberately FIXED at SCALE_M_DEFAULT (90m) rather than
    # tied to the AOI-adaptive `scale` used elsewhere: `streams_mask` comes
    # from HydroSHEDS 15ACC, whose native resolution is ~450m, and
    # reprojecting that sparse/masked layer onto a much finer grid (e.g.
    # 30m) produced resampling artifacts that erased the near-zero
    # stream-adjacent pixels entirely (measured: min HAND jumped from 0m to
    # 8m), which silently zeroed out every low-stage flood/building result.
    kernel_radius_px = min(max(int(round(search_radius_m / SCALE_M_DEFAULT)), 1), 250)
    working_proj = ee.Projection("EPSG:4326").atScale(SCALE_M_DEFAULT)
    stream_elev = stream_elev.reproject(working_proj)
    kernel = ee.Kernel.square(radius=kernel_radius_px, units="pixels")
    nearest_stream_elev = stream_elev.focal_min(kernel=kernel)
    nearest_stream_elev = nearest_stream_elev.updateMask(nearest_stream_elev.lt(99999))

    dem = get_dem_image(dem_source, roi)
    hand = dem.subtract(nearest_stream_elev).max(0).clip(roi).rename("HAND")
    return dem, hand, streams_mask.clip(roi), scale


def compute_hand(data: dict) -> dict:
    """
    Step 1 of the HEC-RAS-equivalent workflow — computes the HAND raster
    and auto-suggests channel hydraulic properties (Manning's n from land
    cover, bed slope, and reach length from the stream network) for the
    Manning's rating-curve step that follows.
    """
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        return {"status": "error", "message": "No ROI (geometry) provided"}

    try:
        dem_source = data.get("dem_source", "SRTM")
        stream_threshold = data.get("stream_threshold", STREAM_THRESHOLD_DEFAULT)
        search_radius_m = data.get("search_radius_m", SEARCH_RADIUS_M_DEFAULT)

        dem, hand, streams_mask, scale = _hand_and_streams(roi, dem_source, stream_threshold, search_radius_m)

        worldcover = ee.Image("ESA/WorldCover/v200/2021").select("Map").clip(roi)
        n_from_vals = list(WORLDCOVER_MANNING_N.keys())
        n_to_vals = list(WORLDCOVER_MANNING_N.values())
        manning_n_img = worldcover.remap(n_from_vals, n_to_vals, 0.035).rename("manning_n")

        slope_frac = ee.Terrain.slope(dem).multiply(np.pi / 180).tan().rename("slope")
        pixel_len_m = ee.Image.pixelArea().sqrt()
        stream_len_contribution = pixel_len_m.updateMask(streams_mask).rename("stream_len")

        stats = ee.Image.cat([manning_n_img, slope_frac]).reduceRegion(
            reducer=ee.Reducer.mean(), geometry=roi, scale=scale, maxPixels=1e10, bestEffort=True,
        )
        length_stats = stream_len_contribution.reduceRegion(
            reducer=ee.Reducer.sum(), geometry=roi, scale=scale, maxPixels=1e10, bestEffort=True,
        )
        hand_pctl = hand.reduceRegion(
            reducer=ee.Reducer.percentile([90]), geometry=roi, scale=scale, maxPixels=1e10, bestEffort=True,
        )

        info = stats.getInfo()
        length_info = length_stats.getInfo()
        pctl_info = hand_pctl.getInfo()

        avg_n = info.get("manning_n") or 0.035
        avg_slope = max(info.get("slope") or 0.001, 0.0005)
        # Rough centerline-length proxy: stream-pixel count * pixel size.
        reach_length_m = length_info.get("stream_len") or 500
        reach_length_m = max(reach_length_m, 100)
        hand_p90 = pctl_info.get("HAND_p90") or 10

        hand_vis = {"min": 0, "max": max(hand_p90, 1), "palette": ["#08306b", "#4292c6", "#c6dbef", "#ffffff"]}
        hand_map = hand.getMapId(hand_vis)

        return {
            "status": "success",
            "layers": [
                {
                    "layerId": "hand",
                    "name": "Height Above Nearest Drainage (HAND)",
                    "visual_url": hand_map["tile_fetcher"].url_format,
                    "download_url": _get_geotiff_url(hand, roi, scale),
                    "recolorable": False,
                },
            ],
            "channel_properties": {
                "manning_n": round(avg_n, 3),
                "bed_slope_percent": round(avg_slope * 100, 3),
                "reach_length_km": round(reach_length_m / 1000, 2),
                "suggested_max_stage_m": round(max(hand_p90 * 1.2, 1), 1),
                "analysis_scale_m": round(scale, 1),
            },
        }
    except Exception as exc:
        logger.exception("compute_hand failed")
        return {"status": "error", "message": str(exc)}


def build_rating_curve(data: dict) -> dict:
    """
    Step 2 — builds a synthetic stage-discharge rating curve (HAND-SRC):
    for a series of stage increments h, the wet-cell HAND storage volume
    and surface area are reduced from GEE in a single server-side pass,
    then converted to an equivalent cross-section and run through
    Manning's equation: Q = (1/n) * A * R^(2/3) * S^(1/2).
    """
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        return {"status": "error", "message": "No ROI (geometry) provided"}

    try:
        dem_source = data.get("dem_source", "SRTM")
        stream_threshold = data.get("stream_threshold", STREAM_THRESHOLD_DEFAULT)
        search_radius_m = data.get("search_radius_m", SEARCH_RADIUS_M_DEFAULT)
        manning_n = float(data.get("manning_n", 0.035))
        bed_slope_percent = float(data.get("bed_slope_percent", 1.0))
        reach_length_m = float(data.get("reach_length_km", 1.0)) * 1000
        max_stage_m = float(data.get("max_stage_m", 5.0))
        n_stages = int(data.get("n_stages", 15))

        if manning_n <= 0 or bed_slope_percent <= 0 or reach_length_m <= 0 or max_stage_m <= 0:
            return {"status": "error", "message": "Invalid channel parameters."}

        _, hand, _, scale = _hand_and_streams(roi, dem_source, stream_threshold, search_radius_m)
        pixel_area_img = ee.Image.pixelArea()

        stage_values = [round(v, 3) for v in np.linspace(max_stage_m / n_stages, max_stage_m, n_stages)]
        stages_list = ee.List(stage_values)

        def stage_stats(h):
            h_num = ee.Number(h)
            wet_mask = hand.lte(h_num)
            depth = ee.Image.constant(h_num).subtract(hand)
            combined = ee.Image.cat([
                pixel_area_img.updateMask(wet_mask).rename("wet_area"),
                depth.multiply(pixel_area_img).updateMask(wet_mask).rename("volume"),
            ])
            stats = combined.reduceRegion(
                reducer=ee.Reducer.sum(), geometry=roi, scale=scale, maxPixels=1e10, bestEffort=True,
            )
            return ee.Dictionary(stats).combine(ee.Dictionary({"stage": h_num}))

        stage_results = stages_list.map(stage_stats).getInfo()
        stage_results.sort(key=lambda item: item.get("stage") or 0)

        bed_slope = bed_slope_percent / 100.0
        curve = []
        running_max_wet_area = 0.0
        running_max_volume = 0.0
        for item in stage_results:
            h = item.get("stage") or 0
            # Flood extent at a higher stage is always a superset of the
            # extent at any lower stage (hand<=h2 contains hand<=h1 for
            # h2>h1), so wet area/volume must be non-decreasing in stage.
            # A narrow, steep channel's flood zone is thin relative to the
            # regular sampling grid reduceRegion uses, so individual points
            # can alias low or even to zero (verified: the same query at
            # scale=3/30/90m returned 0 while scale=6-10m did not) — any
            # decrease here is that sampling noise, not physically real, so
            # it's clamped out rather than left to corrupt Q(stage).
            running_max_wet_area = max(running_max_wet_area, item.get("wet_area") or 0)
            running_max_volume = max(running_max_volume, item.get("volume") or 0)
            wet_area_m2 = running_max_wet_area
            volume_m3 = running_max_volume

            if wet_area_m2 <= 0 or reach_length_m <= 0:
                q_cms = 0.0
            else:
                a_cross = volume_m3 / reach_length_m
                top_width = wet_area_m2 / reach_length_m
                wetted_perimeter = max(top_width, 0.1)
                r_hyd = a_cross / wetted_perimeter
                q_cms = (1.0 / manning_n) * a_cross * (r_hyd ** (2 / 3)) * (bed_slope ** 0.5)

            curve.append({
                "stage_m": round(h, 3),
                "discharge_cms": round(q_cms, 3),
                "flooded_area_km2": round(wet_area_m2 / 1_000_000, 4),
            })

        curve.sort(key=lambda p: p["stage_m"])

        return {
            "status": "success",
            "curve": curve,
            "params": {
                "manning_n": manning_n,
                "bed_slope_percent": bed_slope_percent,
                "reach_length_km": round(reach_length_m / 1000, 2),
            },
        }
    except Exception as exc:
        logger.exception("build_rating_curve failed")
        return {"status": "error", "message": str(exc)}


def _stage_for_discharge(curve, target_q):
    stages = np.array([p["stage_m"] for p in curve])
    discharges = np.array([p["discharge_cms"] for p in curve])
    if target_q <= discharges.max():
        return float(np.interp(target_q, discharges, stages))
    # Extrapolate past the top of the curve using the last two points' slope
    if len(stages) >= 2 and discharges[-1] != discharges[-2]:
        slope = (stages[-1] - stages[-2]) / (discharges[-1] - discharges[-2])
        return float(stages[-1] + slope * (target_q - discharges[-1]))
    return float(stages[-1])


def run_inundation(data: dict) -> dict:
    """
    Step 3 — given a design discharge (typically the peak discharge from
    the HEC-HMS-equivalent Rainfall-Runoff tool) and the rating curve
    from build_rating_curve, finds the corresponding stage and renders
    the flood-extent + depth-grid layers plus summary stats.
    """
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        return {"status": "error", "message": "No ROI (geometry) provided"}

    try:
        dem_source = data.get("dem_source", "SRTM")
        stream_threshold = data.get("stream_threshold", STREAM_THRESHOLD_DEFAULT)
        search_radius_m = data.get("search_radius_m", SEARCH_RADIUS_M_DEFAULT)
        curve = data.get("curve")
        target_q = data.get("design_discharge_cms")

        if not curve:
            return {"status": "error", "message": "No rating curve provided — run the rating-curve step first."}
        if target_q is None:
            return {"status": "error", "message": "design_discharge_cms is required."}

        target_q = float(target_q)
        stage_m = max(_stage_for_discharge(curve, target_q), 0.05)

        _, hand, _, scale = _hand_and_streams(roi, dem_source, stream_threshold, search_radius_m)

        flood_extent = hand.lte(stage_m).selfMask()
        depth_grid = ee.Image.constant(stage_m).subtract(hand).rename("depth").updateMask(flood_extent)

        flood_color = data.get("flood_color", "#2563eb")
        flood_vis = {"palette": ["ffffff00", flood_color.lstrip("#")]}
        flood_map = flood_extent.getMapId(flood_vis)

        depth_vis = {"min": 0, "max": max(stage_m, 0.5), "palette": ["#c6dbef", "#4292c6", "#08306b"]}
        depth_map = depth_grid.getMapId(depth_vis)

        pixel_area_km2 = ee.Image.pixelArea().divide(1_000_000)
        area_stats = pixel_area_km2.updateMask(flood_extent).reduceRegion(
            reducer=ee.Reducer.sum(), geometry=roi, scale=scale, maxPixels=1e10, bestEffort=True,
        )
        depth_stats = depth_grid.reduceRegion(
            reducer=ee.Reducer.mean().combine(ee.Reducer.max(), sharedInputs=True),
            geometry=roi, scale=scale, maxPixels=1e10, bestEffort=True,
        )

        flooded_area_km2 = (area_stats.getInfo().get("area") or 0)
        depth_info = depth_stats.getInfo()
        avg_depth_m = depth_info.get("depth_mean") or 0
        max_depth_m = depth_info.get("depth_max") or 0

        affected_population = None
        try:
            pop_image = worldpop_image().clip(roi)
            pop_result = pop_image.updateMask(flood_extent).reduceRegion(
                reducer=ee.Reducer.sum(), geometry=roi, scale=WORLDPOP_SCALE, maxPixels=1e10, bestEffort=True,
            )
            pop_value = pop_result.get("population")
            if pop_value is not None:
                pop_value = ee.Number(pop_value).getInfo()
                if pop_value is not None:
                    affected_population = round(pop_value)
        except Exception:
            logger.warning("Population estimate failed, continuing without it.", exc_info=True)

        return {
            "status": "success",
            "layers": [
                {
                    "layerId": "flood_extent",
                    "name": "Flood Extent (Manning's Rating Curve)",
                    "visual_url": flood_map["tile_fetcher"].url_format,
                    "download_url": _get_geotiff_url(flood_extent, roi, scale),
                    "recolorable": True,
                    "color": flood_color,
                },
                {
                    "layerId": "flood_depth",
                    "name": "Flood Depth Grid",
                    "visual_url": depth_map["tile_fetcher"].url_format,
                    "download_url": _get_geotiff_url(depth_grid, roi, scale),
                    "recolorable": False,
                },
            ],
            "stats": {
                "design_discharge_cms": round(target_q, 2),
                "water_surface_stage_m": round(stage_m, 2),
                "flooded_area_km2": round(flooded_area_km2, 3),
                "avg_depth_m": round(avg_depth_m, 2),
                "max_depth_m": round(max_depth_m, 2),
                "affected_population": affected_population,
            },
        }
    except Exception as exc:
        logger.exception("run_inundation failed")
        return {"status": "error", "message": str(exc)}


def simulate_flood_rise(data: dict) -> dict:
    """
    Precomputes the flood depth raster at several intermediate stages
    (0 -> target stage), for the frontend to animate as a "rising flood" —
    a real depth-coloured raster sequence (colour = water depth), not just
    a directional line with dots on it. Every frame shares the SAME colour
    scale (0 -> target stage), so depth is visually comparable frame to
    frame as the water spreads and deepens.

    Cheap despite the loop: getMapId() just registers a tile-rendering
    recipe with GEE, it doesn't force the pixels to be computed — the
    actual raster is only rendered lazily as the browser requests tiles.
    """
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        return {"status": "error", "message": "No ROI (geometry) provided"}

    try:
        dem_source = data.get("dem_source", "SRTM")
        stream_threshold = data.get("stream_threshold", STREAM_THRESHOLD_DEFAULT)
        search_radius_m = data.get("search_radius_m", SEARCH_RADIUS_M_DEFAULT)
        target_stage_m = float(data.get("target_stage_m", 2.0))
        n_frames = min(max(int(data.get("n_frames", 10)), 2), 20)

        if target_stage_m <= 0:
            return {"status": "error", "message": "target_stage_m must be positive."}

        _, hand, _, _ = _hand_and_streams(roi, dem_source, stream_threshold, search_radius_m)
        depth_vis = {"min": 0, "max": target_stage_m, "palette": ["#bfdbfe", "#60a5fa", "#2563eb", "#1e3a8a", "#172554"]}

        frames = []
        for i in range(1, n_frames + 1):
            stage = target_stage_m * i / n_frames
            flood_extent = hand.lte(stage).selfMask()
            depth_grid = ee.Image.constant(stage).subtract(hand).max(0).updateMask(flood_extent).rename("depth")
            depth_map = depth_grid.getMapId(depth_vis)
            frames.append({"stage_m": round(stage, 2), "visual_url": depth_map["tile_fetcher"].url_format})

        return {
            "status": "success",
            "frames": frames,
            "target_stage_m": round(target_stage_m, 2),
            "legend": {"min_depth_m": 0, "max_depth_m": round(target_stage_m, 2), "palette": depth_vis["palette"]},
        }
    except Exception as exc:
        logger.exception("simulate_flood_rise failed")
        return {"status": "error", "message": str(exc)}


def get_flow_direction(data: dict) -> dict:
    """
    Approximate stream flow-direction line for map visualization (drawn
    upstream -> downstream, arrows pointing downhill). This is NOT a
    precise flow-routed centerline: it randomly samples points along the
    stream mask, then greedily chains them nearest-neighbour starting from
    the highest-elevation point. That's a cheap approximation appropriate
    for a single contained river reach (the AOI size this tool targets) —
    on a braided or multi-channel river it can jump between channels and
    should be read as indicative, not surveyed.
    """
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        return {"status": "error", "message": "No ROI (geometry) provided"}

    try:
        dem_source = data.get("dem_source", "SRTM")
        stream_threshold = data.get("stream_threshold", STREAM_THRESHOLD_DEFAULT)
        search_radius_m = data.get("search_radius_m", SEARCH_RADIUS_M_DEFAULT)
        max_points = min(int(data.get("max_points", 150)), 300)

        # Sample over a BUFFERED region, not just the drawn AOI: HydroSHEDS
        # 15ACC's ~450m native resolution means a small AOI (the natural
        # size for this tool) can easily contain zero qualifying stream
        # pixels on its own even when a real channel runs just outside it.
        sample_roi = roi.buffer(search_radius_m)
        dem = get_dem_image(dem_source, sample_roi)
        accumulation = ee.Image("WWF/HydroSHEDS/15ACC").select("b1").clip(sample_roi)
        streams_mask = accumulation.gt(stream_threshold)

        sample_img = dem.updateMask(streams_mask).rename("elevation")
        samples = sample_img.sample(region=sample_roi, scale=90, numPixels=max_points, geometries=True, seed=42)
        info = samples.getInfo()

        points = []
        for feat in info.get("features", []):
            coords = feat.get("geometry", {}).get("coordinates")
            elev = feat.get("properties", {}).get("elevation")
            if coords and elev is not None:
                points.append((coords[0], coords[1], elev))

        if len(points) < 2:
            return {
                "status": "success", "geojson": None,
                "message": "Not enough stream points found in this area to draw a flow line.",
            }

        # Greedy nearest-neighbour chain, starting from the highest (most
        # upstream) point, always hopping to whichever remaining point is
        # closest — approximates following the channel downstream.
        points.sort(key=lambda p: -p[2])
        path = [points[0]]
        remaining = points[1:]
        while remaining:
            last = path[-1]
            remaining.sort(key=lambda p: (p[0] - last[0]) ** 2 + (p[1] - last[1]) ** 2)
            path.append(remaining.pop(0))

        line = {
            "type": "Feature",
            "properties": {},
            "geometry": {"type": "LineString", "coordinates": [[p[0], p[1]] for p in path]},
        }
        return {"status": "success", "geojson": line, "point_count": len(path)}
    except Exception as exc:
        logger.exception("get_flow_direction failed")
        return {"status": "error", "message": str(exc)}


def get_flood_flow_field(data: dict) -> dict:
    """
    Samples many points spread across the WHOLE flood extent (not just
    the channel), plus an upstream/downstream bearing anchor pair — so
    the frontend can animate flow particles across the entire inundated
    surface, closer to how HEC-RAS's animated flood view reads, instead
    of a single line. Still a visual approximation: every particle drifts
    along the same overall bearing, not a true per-pixel velocity field
    from a hydrodynamic solve (which this HAND-based tool doesn't compute).
    """
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        return {"status": "error", "message": "No ROI (geometry) provided"}

    try:
        dem_source = data.get("dem_source", "SRTM")
        stream_threshold = data.get("stream_threshold", STREAM_THRESHOLD_DEFAULT)
        search_radius_m = data.get("search_radius_m", SEARCH_RADIUS_M_DEFAULT)
        stage_m = float(data.get("stage_m", 1.0))
        max_points = min(max(int(data.get("max_points", 250)), 10), 500)

        if stage_m <= 0:
            return {"status": "error", "message": "stage_m must be positive."}

        dem, hand, _, _ = _hand_and_streams(roi, dem_source, stream_threshold, search_radius_m)
        flood_extent = hand.lte(stage_m).selfMask()

        sample_img = dem.updateMask(flood_extent).rename("elevation")
        samples = sample_img.sample(region=roi, scale=10, numPixels=max_points, geometries=True, seed=7)
        info = samples.getInfo()

        points = []
        for feat in info.get("features", []):
            coords = feat.get("geometry", {}).get("coordinates")
            if coords:
                points.append(coords)

        if len(points) < 2:
            return {
                "status": "success", "points": [], "upstream_point": None, "downstream_point": None,
                "message": "Not enough flooded area found in this AOI to animate.",
            }

        flow = get_flow_direction(data)
        line_coords = (flow.get("geojson") or {}).get("geometry", {}).get("coordinates") if flow.get("status") == "success" else None
        if line_coords and len(line_coords) >= 2:
            upstream_point, downstream_point = line_coords[0], line_coords[-1]
        else:
            # Fall back to the flood-extent samples themselves if the
            # channel-based bearing couldn't be computed (e.g. no stream
            # cell found within reach) — any consistent direction across
            # the sampled area still reads as "flowing" visually.
            upstream_point, downstream_point = points[0], points[-1]

        return {
            "status": "success",
            "points": points,
            "upstream_point": upstream_point,
            "downstream_point": downstream_point,
        }
    except Exception as exc:
        logger.exception("get_flood_flow_field failed")
        return {"status": "error", "message": str(exc)}
