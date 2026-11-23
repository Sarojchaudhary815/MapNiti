"""
Engineering Toolkit
===================
One-click GEE-backed answers to the questions civil / geomatics engineers
ask first about a site:

  * site_report()        — AOI terrain, slope classes, land cover, rainfall
                           (annual + design 1-day max), temperature, soil,
                           water, population, buildings + screening flags
  * point_inspect()      — everything above, sampled at a single clicked point
  * elevation_profile()  — ground profile along a clicked polyline (road /
                           canal / pipeline alignment) with grades, rise/fall

All heavy numbers are built as one ee.Dictionary and fetched with a single
getInfo() so a report costs one Earth Engine round trip.
"""
import logging
import math
from datetime import date

import ee
from app.services.hydrology_engine import init_earth_engine, get_roi, worldpop_image, WORLDPOP_SCALE, WORLDPOP_YEAR
from app.services.gee_catalog import CATALOG

logger = logging.getLogger("mapniti.engineering")

SLOPE_CLASSES = [
    (0, 5, "Flat (0–5°)", "#1a9850"),
    (5, 15, "Gentle (5–15°)", "#91cf60"),
    (15, 25, "Moderate (15–25°)", "#fee08b"),
    (25, 35, "Steep (25–35°)", "#fc8d59"),
    (35, 45, "Very steep (35–45°)", "#d73027"),
    (45, 91, "Extreme (>45°)", "#7f0000"),
]
ASPECTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
WORLDCOVER = CATALOG["esa_worldcover"]["classes"]
TEXTURE = CATALOG["soil_texture"]["classes"]

NEPAL_BBOX = (80.0, 26.3, 88.3, 30.5)  # west, south, east, north
# WORLDPOP_SCALE (native ~92.77 m grid) comes from hydrology_engine; summing at a coarser
# scale like 100 m resamples and undercounts people by ~15%.


def _dem():
    return ee.Image("USGS/SRTMGL1_003").select("elevation")


def _rain_years(n=10):
    end_year = date.today().year - 1
    return end_year - n + 1, end_year


def _round(v, nd=2):
    return round(v, nd) if isinstance(v, (int, float)) else None


def _in_nepal(lng, lat):
    w, s, e, n = NEPAL_BBOX
    return w <= lng <= e and s <= lat <= n


def utm_zone(lng, lat):
    zone = int((lng + 180) // 6) + 1
    hemi = "N" if lat >= 0 else "S"
    epsg = (32600 if lat >= 0 else 32700) + zone
    return {"zone": f"{zone}{hemi}", "epsg": epsg}


# ==========================================================================
# Site report
# ==========================================================================

def site_report(data: dict) -> dict:
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        return {"status": "error", "message": "Draw or upload an Area of Interest first."}

    try:
        area_km2 = roi.area(maxError=10).divide(1e6).getInfo()
        if area_km2 > 5000:
            return {"status": "error", "message": f"AOI is {area_km2:.0f} km². Keep site reports under 5,000 km²."}

        scale = 30 if area_km2 < 500 else 90
        dem = _dem().clip(roi)
        slope = ee.Terrain.slope(_dem()).clip(roi)
        aspect = ee.Terrain.aspect(_dem()).clip(roi)
        pixel_km2 = ee.Image.pixelArea().divide(1e6)

        # --- terrain ---
        elev = dem.reduceRegion(
            reducer=ee.Reducer.mean().combine(ee.Reducer.minMax(), sharedInputs=True)
            .combine(ee.Reducer.stdDev(), sharedInputs=True)
            .combine(ee.Reducer.percentile([5, 95]), sharedInputs=True),
            geometry=roi, scale=scale, maxPixels=1e10, bestEffort=True)
        slope_stats = slope.reduceRegion(
            reducer=ee.Reducer.mean().combine(ee.Reducer.max(), sharedInputs=True)
            .combine(ee.Reducer.percentile([90]), sharedInputs=True),
            geometry=roi, scale=scale, maxPixels=1e10, bestEffort=True)

        slope_cls = ee.Image(0)
        for i, (lo, hi, _, _) in enumerate(SLOPE_CLASSES):
            slope_cls = slope_cls.where(slope.gte(lo).And(slope.lt(hi)), i)
        slope_cls = slope_cls.clip(roi).rename("cls")
        slope_groups = pixel_km2.addBands(slope_cls).reduceRegion(
            ee.Reducer.sum().group(1, "cls"), roi, scale, maxPixels=1e10, bestEffort=True).get("groups")

        aspect_cls = aspect.add(22.5).mod(360).divide(45).floor().rename("cls")
        aspect_groups = pixel_km2.addBands(aspect_cls).reduceRegion(
            ee.Reducer.sum().group(1, "cls"), roi, scale, maxPixels=1e10, bestEffort=True).get("groups")

        # --- land cover ---
        lc = ee.ImageCollection("ESA/WorldCover/v200").first().select("Map").clip(roi)
        lc_groups = pixel_km2.addBands(lc).reduceRegion(
            ee.Reducer.sum().group(1, "cls"), roi, max(scale, 30), maxPixels=1e10, bestEffort=True).get("groups")

        # --- rainfall (CHIRPS, last 10 complete years) ---
        y0, y1 = _rain_years(10)
        chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY").filterDate(f"{y0}-01-01", f"{y1 + 1}-01-01").select("precipitation")
        annual_mean = chirps.sum().divide(y1 - y0 + 1)
        monsoon = chirps.filter(ee.Filter.calendarRange(6, 9, "month")).sum().divide(y1 - y0 + 1)
        max_1day = chirps.max()
        rain = ee.Image.cat([annual_mean.rename("annual"), monsoon.rename("monsoon"), max_1day.rename("max1day")]).reduceRegion(
            ee.Reducer.mean(), roi, 5566, maxPixels=1e9, bestEffort=True)
        # max 1-day anywhere in AOI (not averaged) is the conservative design value.
        # CHIRPS cells are ~5.5 km, so buffer the AOI or small sites hit no cell centre.
        rain_peak = max_1day.reduceRegion(ee.Reducer.max(), roi.buffer(3000, 100), 5566, maxPixels=1e9, bestEffort=True).get("precipitation")

        # --- temperature (ERA5-Land monthly, last full year) ---
        era = (ee.ImageCollection("ECMWF/ERA5_LAND/MONTHLY_AGGR").filterDate(f"{y1}-01-01", f"{y1 + 1}-01-01")
               .select("temperature_2m"))
        temp = ee.Image.cat([
            era.mean().subtract(273.15).rename("mean"),
            era.min().subtract(273.15).rename("coldest_month"),
            era.max().subtract(273.15).rename("warmest_month"),
        ]).reduceRegion(ee.Reducer.mean(), roi, 11132, maxPixels=1e9, bestEffort=True)

        # --- soil ---
        soil = ee.Image.cat([
            ee.Image("OpenLandMap/SOL/SOL_CLAY-WFRACTION_USDA-3A1A1A_M/v02").select("b0").rename("clay"),
            ee.Image("OpenLandMap/SOL/SOL_SAND-WFRACTION_USDA-3A1A1A_M/v02").select("b0").rename("sand"),
            ee.Image("OpenLandMap/SOL/SOL_PH-H2O_USDA-4C1A2A_M/v02").select("b0").divide(10).rename("ph"),
        ]).reduceRegion(ee.Reducer.mean(), roi, 250, maxPixels=1e9, bestEffort=True)
        texture_mode = (ee.Image("OpenLandMap/SOL/SOL_TEXTURE-CLASS_USDA-TT_M/v02").select("b0")
                        .reduceRegion(ee.Reducer.mode(), roi, 250, maxPixels=1e9, bestEffort=True).get("b0"))

        # --- water, people, built-up, trees ---
        water = ee.Image("JRC/GSW1_4/GlobalSurfaceWater").select("occurrence").unmask(0)
        water_km2 = pixel_km2.updateMask(water.gt(50)).reduceRegion(ee.Reducer.sum(), roi, 30, maxPixels=1e10, bestEffort=True).get("area")
        flood_prone_km2 = pixel_km2.updateMask(water.gt(0).And(water.lte(50))).reduceRegion(
            ee.Reducer.sum(), roi, 30, maxPixels=1e10, bestEffort=True).get("area")
        pop = (worldpop_image()
               .reduceRegion(ee.Reducer.sum(), roi, WORLDPOP_SCALE, maxPixels=1e10, bestEffort=True).get("population"))
        built = (ee.Image("JRC/GHSL/P2023A/GHS_BUILT_S/2020").select("built_surface")
                 .reduceRegion(ee.Reducer.sum(), roi, 100, maxPixels=1e10, bestEffort=True).get("built_surface"))
        trees = (ee.Image("UMD/hansen/global_forest_change_2025_v1_13").select("treecover2000")
                 .reduceRegion(ee.Reducer.mean(), roi, 30, maxPixels=1e10, bestEffort=True).get("treecover2000"))

        payload = {
            "elev": elev, "slope": slope_stats, "slope_groups": slope_groups, "aspect_groups": aspect_groups,
            "lc_groups": lc_groups, "rain": rain, "rain_peak": rain_peak, "temp": temp, "soil": soil,
            "texture_mode": texture_mode, "water_km2": water_km2, "flood_prone_km2": flood_prone_km2,
            "population": pop, "built_m2": built, "tree_cover": trees,
        }
        if area_km2 <= 200:
            payload["buildings"] = ee.FeatureCollection("GOOGLE/Research/open-buildings/v3/polygons").filterBounds(roi).size()

        r = ee.Dictionary(payload).getInfo()

        # slope-class map for the map window
        slope_map = slope_cls.getMapId({"min": 0, "max": len(SLOPE_CLASSES) - 1, "palette": [c[3] for c in SLOPE_CLASSES]})

        centroid = roi.centroid(maxError=10).coordinates().getInfo()
        report = _assemble_report(r, area_km2, centroid, (y0, y1))
        report["layers"] = [{
            "layerId": "eng-slope-classes", "name": "Slope classes",
            "visual_url": slope_map["tile_fetcher"].url_format, "opacity": 0.75,
        }]
        report["status"] = "success"
        return report
    except ee.EEException as exc:
        logger.warning("site_report EE error: %s", exc)
        return {"status": "error", "message": f"Earth Engine: {exc}"}
    except Exception as exc:
        logger.exception("site_report failed")
        return {"status": "error", "message": str(exc)}


def _groups_to_rows(groups, labels, total_km2):
    rows = []
    for g in groups or []:
        idx = int(g["cls"])
        label, color = labels(idx)
        rows.append({"label": label, "color": color, "area_km2": _round(g["sum"], 3),
                     "percent": _round(100 * g["sum"] / total_km2 if total_km2 else 0, 1)})
    return rows


def _assemble_report(r, area_km2, centroid, rain_years):
    elev, slope, rain, temp, soil = r["elev"], r["slope"], r["rain"], r["temp"], r["soil"]
    lng, lat = centroid

    slope_total = sum(g["sum"] for g in r["slope_groups"] or []) or area_km2
    slope_rows = _groups_to_rows(r["slope_groups"], lambda i: (SLOPE_CLASSES[i][2], SLOPE_CLASSES[i][3]), slope_total)

    aspect_total = sum(g["sum"] for g in r["aspect_groups"] or []) or area_km2
    aspect_rows = _groups_to_rows(r["aspect_groups"], lambda i: (ASPECTS[i % 8], "#64748b"), aspect_total)
    dominant_aspect = max(aspect_rows, key=lambda x: x["area_km2"])["label"] if aspect_rows else None

    lc_total = sum(g["sum"] for g in r["lc_groups"] or []) or area_km2
    lc_rows = sorted(_groups_to_rows(r["lc_groups"], lambda c: WORLDCOVER.get(c, (f"Class {c}", "#999")), lc_total),
                     key=lambda x: -x["area_km2"])

    texture_code = r.get("texture_mode")
    texture = TEXTURE.get(int(texture_code))[0] if isinstance(texture_code, (int, float)) and int(texture_code) in TEXTURE else None

    built_km2 = (r.get("built_m2") or 0) / 1e6
    report = {
        "area_km2": _round(area_km2, 3),
        "area_ha": _round(area_km2 * 100, 2),
        "area_ropani": _round(area_km2 * 1e6 / 508.72, 1),
        "area_bigha": _round(area_km2 * 1e6 / 6772.63, 2),
        "centroid": {"lat": _round(lat, 6), "lng": _round(lng, 6), **utm_zone(lng, lat)},
        "terrain": {
            "elev_min": _round(elev.get("elevation_min"), 1), "elev_max": _round(elev.get("elevation_max"), 1),
            "elev_mean": _round(elev.get("elevation_mean"), 1), "elev_std": _round(elev.get("elevation_stdDev"), 1),
            "elev_p5": _round(elev.get("elevation_p5"), 1), "elev_p95": _round(elev.get("elevation_p95"), 1),
            "relief": _round((elev.get("elevation_max") or 0) - (elev.get("elevation_min") or 0), 1),
            "slope_mean": _round(slope.get("slope_mean"), 1), "slope_max": _round(slope.get("slope_max"), 1),
            "slope_p90": _round(slope.get("slope_p90"), 1),
            "slope_mean_percent": _round(math.tan(math.radians(slope.get("slope_mean") or 0)) * 100, 1),
            "dominant_aspect": dominant_aspect,
        },
        "slope_classes": slope_rows,
        "aspect": aspect_rows,
        "land_cover": lc_rows,
        "climate": {
            "period": f"{rain_years[0]}–{rain_years[1]}",
            "annual_rain_mm": _round(rain.get("annual"), 0),
            "monsoon_rain_mm": _round(rain.get("monsoon"), 0),
            "monsoon_share_pct": _round(100 * (rain.get("monsoon") or 0) / rain["annual"], 1) if rain.get("annual") else None,
            "max_1day_rain_mm": _round(r.get("rain_peak"), 1),
            "temp_mean_c": _round(temp.get("mean"), 1),
            "temp_coldest_month_c": _round(temp.get("coldest_month"), 1),
            "temp_warmest_month_c": _round(temp.get("warmest_month"), 1),
        },
        "soil": {
            "clay_pct": _round(soil.get("clay"), 1), "sand_pct": _round(soil.get("sand"), 1),
            "silt_pct": _round(100 - (soil.get("clay") or 0) - (soil.get("sand") or 0), 1) if soil.get("clay") is not None else None,
            "ph": _round(soil.get("ph"), 1), "texture": texture,
        },
        "water": {
            "permanent_water_km2": _round(r.get("water_km2"), 3),
            "occasional_water_km2": _round(r.get("flood_prone_km2"), 3),
        },
        "people": {
            "population_est": int(round(r.get("population") or 0)), "population_year": WORLDPOP_YEAR,
            "density_per_km2": _round((r.get("population") or 0) / area_km2, 1) if area_km2 else None,
            "built_up_km2": _round(built_km2, 3),
            "built_up_pct": _round(100 * built_km2 / area_km2, 2) if area_km2 else None,
            "buildings": r.get("buildings"),
            "tree_cover_pct_2000": _round(r.get("tree_cover"), 1),
        },
    }
    report["flags"] = _screening_flags(report, lng, lat)
    return report


def _screening_flags(rep, lng, lat):
    """Desk-study screening notes — not a substitute for site investigation."""
    flags = []
    t, c, s, w = rep["terrain"], rep["climate"], rep["soil"], rep["water"]
    steep = sum(x["percent"] or 0 for x in rep["slope_classes"] if x["label"].startswith(("Steep", "Very", "Extreme")))
    if steep >= 30:
        flags.append({"level": "high", "topic": "Slope stability",
                      "text": f"{steep:.0f}% of the area is steeper than 25°. Plan landslide hazard mapping, slope protection "
                              "(retaining / breast walls, bio-engineering) and avoid cut slopes without geotechnical design."})
    elif steep >= 10:
        flags.append({"level": "medium", "topic": "Slope stability",
                      "text": f"{steep:.0f}% of the area is steeper than 25°. Check alignment/site grading and local instability."})
    if (s.get("clay_pct") or 0) >= 35:
        flags.append({"level": "medium", "topic": "Subgrade / foundation",
                      "text": f"Surface clay ≈{s['clay_pct']}%. Possible expansive or low-CBR subgrade — verify with "
                              "soil tests (Atterberg limits, CBR, SPT) before pavement/foundation design."})
    if (s.get("sand_pct") or 0) >= 70:
        flags.append({"level": "medium", "topic": "Soil",
                      "text": "Sandy soil — good drainage but check erosion, scour and liquefaction potential (with water table)."})
    if (c.get("max_1day_rain_mm") or 0) >= 150:
        flags.append({"level": "high", "topic": "Drainage design",
                      "text": f"Max 1-day rainfall ≈{c['max_1day_rain_mm']} mm in {c['period']}. Size side drains, culverts "
                              "and cross-drainage for intense monsoon storms (use IDF / rational method)."})
    if (w.get("permanent_water_km2") or 0) > 0 or (w.get("occasional_water_km2") or 0) > 0:
        flags.append({"level": "medium", "topic": "Flooding / river",
                      "text": "Surface water detected within the AOI (JRC 1984–2021). Check HFL, river training and setback requirements."})
    if (t.get("elev_max") or 0) >= 3000:
        flags.append({"level": "medium", "topic": "High altitude",
                      "text": "Parts of the site are above 3,000 m — consider frost action, snow load and a short construction season."})
    if _in_nepal(lng, lat):
        flags.append({"level": "info", "topic": "Seismic",
                      "text": "Site is in Nepal — a high-seismicity region. Use NBC 105:2020 (seismic zoning factor Z ranges "
                              "0.25–0.40 by location) for structural design."})
    if not flags:
        flags.append({"level": "info", "topic": "General", "text": "No major desk-study red flags. Confirm with site investigation."})
    return flags


# ==========================================================================
# Point inspector
# ==========================================================================

def point_inspect(data: dict) -> dict:
    init_earth_engine()
    try:
        lat = float(data["lat"])
        lng = float(data["lng"])
    except (KeyError, TypeError, ValueError):
        return {"status": "error", "message": "lat and lng are required."}

    try:
        pt = ee.Geometry.Point([lng, lat])
        y0, y1 = _rain_years(10)
        stack = ee.Image.cat([
            _dem().rename("elevation"),
            ee.Terrain.slope(_dem()).rename("slope"),
            ee.Terrain.aspect(_dem()).rename("aspect"),
            ee.ImageCollection("ESA/WorldCover/v200").first().select("Map").rename("landcover"),
            ee.Image("OpenLandMap/SOL/SOL_CLAY-WFRACTION_USDA-3A1A1A_M/v02").select("b0").rename("clay"),
            ee.Image("OpenLandMap/SOL/SOL_SAND-WFRACTION_USDA-3A1A1A_M/v02").select("b0").rename("sand"),
            ee.Image("OpenLandMap/SOL/SOL_TEXTURE-CLASS_USDA-TT_M/v02").select("b0").rename("texture"),
            ee.Image("JRC/GSW1_4/GlobalSurfaceWater").select("occurrence").unmask(0).rename("water"),
            ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY").filterDate(f"{y0}-01-01", f"{y1 + 1}-01-01")
                .select("precipitation").sum().divide(y1 - y0 + 1).rename("annual_rain"),
            worldpop_image().rename("pop"),
        ])
        v = stack.reduceRegion(ee.Reducer.first(), pt, 30).getInfo() or {}
        lc = v.get("landcover")
        tex = v.get("texture")
        slope = v.get("slope")
        aspect = v.get("aspect")
        return {
            "status": "success",
            "lat": lat, "lng": lng, **utm_zone(lng, lat),
            "elevation_m": _round(v.get("elevation"), 1),
            "slope_deg": _round(slope, 1),
            "slope_pct": _round(math.tan(math.radians(slope)) * 100, 1) if slope is not None else None,
            "aspect_deg": _round(aspect, 0),
            "aspect_dir": ASPECTS[int(((aspect + 22.5) % 360) // 45)] if aspect is not None else None,
            "land_cover": WORLDCOVER.get(int(lc), (None,))[0] if lc is not None else None,
            "soil_texture": TEXTURE.get(int(tex), (None,))[0] if tex is not None else None,
            "clay_pct": _round(v.get("clay"), 0), "sand_pct": _round(v.get("sand"), 0),
            "water_occurrence_pct": _round(v.get("water"), 0),
            "annual_rain_mm": _round(v.get("annual_rain"), 0),
            "population_per_100m_cell": _round(v.get("pop"), 1),
        }
    except ee.EEException as exc:
        return {"status": "error", "message": f"Earth Engine: {exc}"}
    except Exception as exc:
        logger.exception("point_inspect failed")
        return {"status": "error", "message": str(exc)}


# ==========================================================================
# Elevation profile
# ==========================================================================

def _haversine(a, b):
    R = 6371008.8
    lat1, lat2 = math.radians(a[1]), math.radians(b[1])
    dlat = lat2 - lat1
    dlng = math.radians(b[0] - a[0])
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


DEM_FOR_PROFILE = {
    "SRTM": lambda: ee.Image("USGS/SRTMGL1_003").select("elevation"),
    "COPERNICUS": lambda: ee.ImageCollection("COPERNICUS/DEM/GLO30_2024_1").select("DEM").mosaic().rename("elevation"),
    "ALOS": lambda: ee.ImageCollection("JAXA/ALOS/AW3D30/V4_1").select("DSM").mosaic().rename("elevation"),
}


def elevation_profile(data: dict) -> dict:
    init_earth_engine()
    pts = data.get("points") or []
    coords = []
    for p in pts:
        try:
            coords.append((float(p["lng"]), float(p["lat"])))
        except (KeyError, TypeError, ValueError):
            continue
    if len(coords) < 2:
        return {"status": "error", "message": "Click at least 2 points on the map to define the alignment."}

    samples = max(20, min(int(data.get("samples", 150)), 500))
    seg_len = [_haversine(coords[i], coords[i + 1]) for i in range(len(coords) - 1)]
    total = sum(seg_len)
    if total <= 0:
        return {"status": "error", "message": "Points are identical — pick distinct points."}

    step = total / (samples - 1)
    sample_pts = []
    for k in range(samples):
        d = k * step
        acc = 0
        for i, L in enumerate(seg_len):
            if d <= acc + L or i == len(seg_len) - 1:
                t = 0 if L == 0 else min(1, (d - acc) / L)
                a, b = coords[i], coords[i + 1]
                sample_pts.append((a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), d))
                break
            acc += L

    try:
        dem = DEM_FOR_PROFILE.get(data.get("dem_source", "SRTM"), DEM_FOR_PROFILE["SRTM"])()
        fc = ee.FeatureCollection([ee.Feature(ee.Geometry.Point([x, y]), {"i": i, "d": d}) for i, (x, y, d) in enumerate(sample_pts)])
        sampled = dem.reduceRegions(collection=fc, reducer=ee.Reducer.first(), scale=30).getInfo()["features"]
        by_i = {f["properties"]["i"]: f["properties"].get("first") for f in sampled}

        profile = []
        for i, (x, y, d) in enumerate(sample_pts):
            z = by_i.get(i)
            profile.append({"distance_m": round(d, 1), "elevation_m": _round(z, 1), "lat": round(y, 6), "lng": round(x, 6)})

        zs = [p for p in profile if p["elevation_m"] is not None]
        ascent = descent = 0.0
        max_grade = 0.0
        for a, b in zip(zs, zs[1:]):
            dz = b["elevation_m"] - a["elevation_m"]
            dd = b["distance_m"] - a["distance_m"]
            if dz > 0:
                ascent += dz
            else:
                descent -= dz
            if dd > 0:
                max_grade = max(max_grade, abs(dz) / dd * 100)
        start_z, end_z = zs[0]["elevation_m"], zs[-1]["elevation_m"]
        return {
            "status": "success",
            "profile": profile,
            "summary": {
                "length_m": round(total, 1),
                "start_elev": start_z, "end_elev": end_z,
                "min_elev": min(p["elevation_m"] for p in zs), "max_elev": max(p["elevation_m"] for p in zs),
                "total_ascent_m": round(ascent, 1), "total_descent_m": round(descent, 1),
                "avg_grade_pct": round((end_z - start_z) / total * 100, 2),
                "max_grade_pct": round(max_grade, 1),
                "sample_spacing_m": round(step, 1),
            },
        }
    except ee.EEException as exc:
        return {"status": "error", "message": f"Earth Engine: {exc}"}
    except Exception as exc:
        logger.exception("elevation_profile failed")
        return {"status": "error", "message": str(exc)}
