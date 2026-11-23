"""
Analysis Engine
===============
Real, Earth-Engine-backed implementations of the Urban, Disaster,
Agriculture and Hydrology analysis tools.

Every tool returns the same response shape so one frontend runner renders
them all:

    {
      "status": "success",
      "title":  str,
      "layers": [{layerId, name, visual_url, opacity, download_url}],   # raster tiles
      "vectors": [{id, name, type: line|fill|circle, color|colorProp, data: GeoJSON}],
      "legend": {type: "classes"|"gradient", ...},
      "stats":  [{label, value, unit}],
      "table":  {title, columns: [...], rows: [[...]]},
      "chart":  {title, type: bar|line, xKey, yKey, unit, data: [...]},
      "notes":  [str],
    }

Scores used by the weighted-overlay tools (suitability, flood, landslide,
wildfire, multi-hazard) are 1 (low) … 5 (high); weights are normalised so
they always sum to 1. These are desk-study screening models — every result
says so in its notes.
"""
import json
import logging
import math
from datetime import datetime, timedelta
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError as FuturesTimeout
from datetime import date

import ee
from pyproj import Geod
from shapely.geometry import shape, mapping
from shapely.ops import transform, unary_union
from pyproj import Transformer

from app.services.hydrology_engine import init_earth_engine, get_roi, worldpop_image, WORLDPOP_YEAR
from app.services.gee_catalog import CATALOG

logger = logging.getLogger("mapniti.analysis")
GEOD = Geod(ellps="WGS84")

CLASS5 = [
    (1, "Very low", "#1a9850"), (2, "Low", "#91cf60"), (3, "Moderate", "#fee08b"),
    (4, "High", "#fc8d59"), (5, "Very high", "#d73027"),
]
CLASS5_SUIT = [
    (1, "Not suitable", "#d7191c"), (2, "Marginal", "#fdae61"), (3, "Moderate", "#ffffbf"),
    (4, "Suitable", "#a6d96a"), (5, "Highly suitable", "#1a9641"),
]
WORLDCOVER = CATALOG["esa_worldcover"]["classes"]
DW_CLASSES = CATALOG["dynamic_world"]["classes"]


# ==========================================================================
# Shared helpers
# ==========================================================================

class AnalysisError(Exception):
    pass


def _roi(data, max_km2=5000):
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        raise AnalysisError("Draw or upload an Area of Interest first.")
    area = roi.area(maxError=10).divide(1e6).getInfo()
    if area > max_km2:
        raise AnalysisError(f"AOI is {area:,.0f} km². This tool supports up to {max_km2:,} km² — draw a smaller area.")
    return roi, area


def _scale_for(area_km2, base=30):
    if area_km2 <= 300:
        return base
    if area_km2 <= 1500:
        return max(base, 60)
    return max(base, 120)


def _weights(data, defaults):
    w = {k: float(data.get(f"w_{k}", v)) for k, v in defaults.items()}
    total = sum(max(v, 0) for v in w.values()) or 1
    return {k: max(v, 0) / total for k, v in w.items()}


def _num(data, key, default, lo=None, hi=None):
    try:
        v = float(data.get(key, default))
    except (TypeError, ValueError):
        v = default
    if lo is not None:
        v = max(lo, v)
    if hi is not None:
        v = min(hi, v)
    return v


def _year(data, key="year", default=None, lo=2000, hi=None):
    hi = hi or date.today().year
    default = default or date.today().year - 1
    return int(_num(data, key, default, lo, hi))


def _tile(img, vis):
    return img.getMapId(vis)["tile_fetcher"].url_format


def _download(img, roi, scale):
    try:
        return img.getDownloadURL({"region": roi, "scale": max(scale, 30), "format": "GEO_TIFF", "crs": "EPSG:4326"})
    except Exception:
        return None


def _class_layer(img, classes, roi, scale, layer_id, name, opacity=0.8):
    """img holds integer class codes; returns (layer, legend, rows)."""
    codes = [c[0] for c in classes]
    palette = [c[2] for c in classes]
    shown = img.remap(codes, list(range(len(codes)))).selfMask() if codes != list(range(len(codes))) else img
    url = _tile(shown, {"min": 0, "max": len(codes) - 1, "palette": palette})
    layer = {"layerId": layer_id, "name": name, "visual_url": url, "opacity": opacity,
             "download_url": _download(img.toByte(), roi, scale)}
    legend = {"type": "classes", "items": [{"value": c, "label": l, "color": col} for c, l, col in classes]}
    return layer, legend


def _class_areas_expr(img, roi, scale):
    return (ee.Image.pixelArea().divide(1e6).addBands(img.rename("cls"))
            .reduceRegion(ee.Reducer.sum().group(1, "cls"), roi, scale, maxPixels=1e10, bestEffort=True)
            .get("groups"))


def _rows_from_groups(groups, classes):
    lut = {c[0]: (c[1], c[2]) for c in classes}
    total = sum(g["sum"] for g in groups or []) or 1
    rows = []
    for c in classes:
        g = next((x for x in groups or [] if int(x["cls"]) == c[0]), None)
        km2 = g["sum"] if g else 0
        rows.append({"code": c[0], "label": lut[c[0]][0], "color": lut[c[0]][1],
                     "area_km2": round(km2, 3), "percent": round(100 * km2 / total, 1)})
    return rows


def _classify5(index, breaks):
    """index -> 1..5 using 4 ascending breaks."""
    out = ee.Image(1)
    for i, b in enumerate(breaks):
        out = out.where(index.gt(b), i + 2)
    return out.updateMask(index.mask()).toInt()


def _score(img, breaks, scores):
    """Piecewise score: value < breaks[0] -> scores[0], ... >= last -> scores[-1]."""
    out = ee.Image(scores[-1])
    for b, s in reversed(list(zip(breaks, scores[:-1]))):
        out = out.where(img.lt(b), s)
    return out


def _dem():
    return ee.Image("USGS/SRTMGL1_003").select("elevation")


def _slope():
    return ee.Terrain.slope(_dem())


def _worldpop():
    return worldpop_image()


def _worldcover():
    return ee.ImageCollection("ESA/WorldCover/v200").first().select("Map")


def _exposure_by_class(cls_img, roi, scale):
    """Population, built-up and cropland per hazard class (one getInfo)."""
    pop = _worldpop().rename("pop")
    built = ee.Image("JRC/GHSL/P2023A/GHS_BUILT_S/2020").select("built_surface").divide(1e6).rename("built")  # km² per cell
    crop = _worldcover().eq(40).multiply(ee.Image.pixelArea()).divide(1e6).rename("crop")
    stack = pop.addBands(built).addBands(crop).addBands(cls_img.rename("cls"))
    res = stack.reduceRegion(
        ee.Reducer.sum().repeat(3).group(3, "cls"), roi, 100, maxPixels=1e10, bestEffort=True).get("groups")
    return res


def _exposure_rows(groups, classes):
    rows = []
    for c in classes:
        g = next((x for x in groups or [] if int(x["cls"]) == c[0]), None)
        s = g["sum"] if g else [0, 0, 0]
        rows.append([c[1], f"{int(round(s[0])):,}", round(s[1], 3), round(s[2], 3)])
    return rows


def _ms_to_date(ms):
    """USGS times are epoch ms and can be negative (pre-1970); date.fromtimestamp
    rejects negatives on Windows, so add a timedelta instead."""
    return (datetime(1970, 1, 1) + timedelta(milliseconds=ms)).date()


def _nepal_note(roi):
    lng, lat = roi.centroid(maxError=10).coordinates().getInfo()
    return 80.0 <= lng <= 88.3 and 26.3 <= lat <= 30.5


def _ok(**kw):
    kw.setdefault("status", "success")
    kw.setdefault("layers", [])
    kw.setdefault("vectors", [])
    kw.setdefault("stats", [])
    kw.setdefault("notes", [])
    return kw


def run_tool(tool_id: str, data: dict) -> dict:
    fn = TOOLS.get(tool_id)
    if not fn:
        return {"status": "error", "message": f"Unknown analysis '{tool_id}'."}
    try:
        return fn(data)
    except AnalysisError as exc:
        return {"status": "error", "message": str(exc)}
    except ee.EEException as exc:
        logger.warning("%s EE error: %s", tool_id, exc)
        return {"status": "error", "message": f"Earth Engine: {exc}"}
    except Exception as exc:  # noqa: BLE001 — surface a readable message to the UI
        logger.exception("analysis %s failed", tool_id)
        return {"status": "error", "message": str(exc)}


# ==========================================================================
# URBAN PLANNING
# ==========================================================================

def urban_lulc(data):
    roi, area = _roi(data)
    year = _year(data, lo=2016)
    scale = _scale_for(area, 10)
    dw = (ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1").filterBounds(roi)
          .filterDate(f"{year}-01-01", f"{year + 1}-01-01").select("label").mode().clip(roi))
    classes = [(k, v[0], v[1]) for k, v in DW_CLASSES.items()]
    layer, legend = _class_layer(dw, classes, roi, scale, "urban-lulc", f"Land cover {year}")
    rows = _rows_from_groups(_class_areas_expr(dw, roi, scale).getInfo(), classes)
    # Dynamic World has no class where every scene of the year was cloud, snow
    # or terrain shadow (common in the mountains). Report that gap as "No data"
    # and express every share as a percentage of the whole AOI.
    classified = sum(r["area_km2"] for r in rows)
    no_data = max(0.0, area - classified)
    for r in rows:
        r["percent"] = round(100 * r["area_km2"] / area, 1) if area else 0
    notes = ["Dynamic World: most frequent Sentinel-2 class in the year. Compare years to see change."]
    if area and no_data / area > 0.005:
        rows.append({"code": 0, "label": "No data", "color": "#d1d5db",
                     "area_km2": round(no_data, 3), "percent": round(100 * no_data / area, 1)})
        notes.append(f"{round(100 * no_data / area)}% of the AOI has no Dynamic World class for {year} "
                     "(every scene was cloud, snow or shadow; common in high mountains). "
                     "For full coverage use ESA WorldCover in the GEE Data Hub.")
    built = next(r for r in rows if r["label"] == "Built")
    return _ok(
        title=f"Land Use / Land Cover {year} (Dynamic World 10 m)",
        layers=[layer], legend=legend,
        stats=[{"label": "AOI area", "value": round(area, 2), "unit": "km²"},
               {"label": "Built-up", "value": built["area_km2"], "unit": f"km² ({built['percent']}%)"},
               {"label": "Dominant class", "value": max((r for r in rows if r["code"]), key=lambda r: r["area_km2"])["label"], "unit": ""}],
        table={"title": "Area by class", "columns": ["Class", "Area (km²)", "Share (%)"],
               "rows": [[r["label"], r["area_km2"], r["percent"]] for r in rows if r["area_km2"] > 0]},
        chart={"title": "Area by class (km²)", "type": "bar", "xKey": "label", "yKey": "area_km2", "unit": "km²",
               "data": [r for r in rows if r["area_km2"] > 0]},
        notes=notes,
    )


GHSL_EPOCHS = [1975, 1980, 1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020, 2025, 2030]


def urban_growth(data):
    roi, area = _roi(data)
    start = int(data.get("start_epoch", 2000))
    end = int(data.get("end_epoch", 2020))
    if start not in GHSL_EPOCHS or end not in GHSL_EPOCHS or start >= end:
        raise AnalysisError("Pick a start epoch earlier than the end epoch.")
    scale = 100
    ghsl = lambda y: ee.Image(f"JRC/GHSL/P2023A/GHS_BUILT_S/{y}").select("built_surface")
    thr = 1000  # m² built per 100 m cell (10%) counts as "built-up"
    b0 = ghsl(start).gte(thr)
    b1 = ghsl(end).gte(thr)
    change = ee.Image(0).where(b0, 1).where(b1.And(b0.Not()), 2).selfMask().clip(roi)
    classes = [(1, f"Built-up by {start}", "#6b7280"), (2, f"New built-up {start}–{end}", "#ef4444")]
    layer, legend = _class_layer(change, classes, roi, scale, "urban-growth", "Urban growth", 0.85)

    stack = ee.Image.cat([ghsl(y).rename(str(y)) for y in GHSL_EPOCHS]).divide(1e6)
    series = stack.reduceRegion(ee.Reducer.sum(), roi, scale, maxPixels=1e10, bestEffort=True).getInfo()
    chart = [{"year": str(y), "built_km2": round(series.get(str(y)) or 0, 3), "projected": y > 2020} for y in GHSL_EPOCHS]
    a0 = series.get(str(start)) or 0
    a1 = series.get(str(end)) or 0
    years = end - start
    cagr = ((a1 / a0) ** (1 / years) - 1) * 100 if a0 > 0 else None
    return _ok(
        title=f"Urban growth {start} → {end} (GHSL)",
        layers=[layer], legend=legend,
        stats=[{"label": f"Built-up {start}", "value": round(a0, 3), "unit": "km²"},
               {"label": f"Built-up {end}", "value": round(a1, 3), "unit": "km²"},
               {"label": "Increase", "value": round(100 * (a1 - a0) / a0, 1) if a0 else None, "unit": "%"},
               {"label": "Annual growth rate", "value": round(cagr, 2) if cagr is not None else None, "unit": "%/yr"},
               {"label": "Built-up share now", "value": round(100 * a1 / area, 2), "unit": "% of AOI"}],
        chart={"title": "Built-up area by epoch (km²) — 2025/2030 are GHSL projections", "type": "bar",
               "xKey": "year", "yKey": "built_km2", "unit": "km²", "data": chart},
        notes=["GHSL P2023A built-up surface, 100 m grid. 2025 and 2030 are model projections from JRC.",
               "Red = cells that became ≥10% built between the two epochs."],
    )


OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

ROAD_COLORS = {
    "motorway": "#e11d48", "trunk": "#ea580c", "primary": "#f59e0b", "secondary": "#eab308",
    "tertiary": "#84cc16", "unclassified": "#22c55e", "residential": "#06b6d4", "service": "#94a3b8",
    "track": "#a16207", "path": "#78716c", "footway": "#78716c",
}


def _overpass_one(url, body, timeout):
    req = urllib.request.Request(url, data=body, headers={"User-Agent": "MapNiti/1.0 (GIS platform)"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = json.loads(r.read().decode())
    if "elements" not in data:  # Overpass reports overload inside a 200 response
        raise RuntimeError(data.get("remark") or "no elements in response")
    return data


def overpass(query: str, timeout=90) -> dict:
    """Ask all public Overpass servers at once and return the first good answer.

    Single servers are often overloaded (502/504/429 or a hung connection), so
    trying them one after another could block a tool for minutes. Racing them
    keeps the wait close to the fastest healthy server, capped near `timeout`.
    """
    body = urllib.parse.urlencode({"data": query}).encode()
    pool = ThreadPoolExecutor(max_workers=len(OVERPASS_URLS))
    futures = {pool.submit(_overpass_one, url, body, timeout): url for url in OVERPASS_URLS}
    last = None
    try:
        for fut in as_completed(futures, timeout=timeout + 5):
            try:
                return fut.result()
            except Exception as exc:  # noqa: BLE001 — wait for the other servers
                last = exc
                logger.info("Overpass %s failed: %s", futures[fut], exc)
    except FuturesTimeout:
        last = TimeoutError("The read operation timed out")
    finally:
        pool.shutdown(wait=False, cancel_futures=True)  # don't wait for the slower servers
    raise last or RuntimeError("no Overpass server answered")


def osm_to_geojson(osm: dict) -> dict:
    """Convert Overpass `out geom` JSON (nodes/ways) to GeoJSON features."""
    feats = []
    for el in osm.get("elements", []):
        tags = el.get("tags", {})
        if el["type"] == "node":
            geom = {"type": "Point", "coordinates": [el["lon"], el["lat"]]}
        elif el["type"] == "way" and el.get("geometry"):
            coords = [[p["lon"], p["lat"]] for p in el["geometry"]]
            closed = len(coords) > 3 and coords[0] == coords[-1]
            is_area = closed and (tags.get("building") or tags.get("landuse") or tags.get("natural") == "water"
                                  or tags.get("area") == "yes" or tags.get("amenity") or tags.get("leisure"))
            geom = {"type": "Polygon", "coordinates": [coords]} if is_area else {"type": "LineString", "coordinates": coords}
        else:
            continue
        feats.append({"type": "Feature", "properties": {"osm_id": el["id"], **tags}, "geometry": geom})
    return {"type": "FeatureCollection", "features": feats}


def _aoi_shape(data):
    g = data.get("geometry")
    if g.get("type") == "FeatureCollection":
        g = g["features"][0]["geometry"]
    elif g.get("type") == "Feature":
        g = g["geometry"]
    return shape(g)


def _utm_transformers(lon, lat):
    epsg = (32600 if lat >= 0 else 32700) + int((lon + 180) // 6) + 1
    fwd = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True).transform
    inv = Transformer.from_crs(f"EPSG:{epsg}", "EPSG:4326", always_xy=True).transform
    return fwd, inv, epsg


def urban_roads(data):
    if not data.get("geometry"):
        raise AnalysisError("Draw or upload an Area of Interest first.")
    aoi = _aoi_shape(data)
    area_km2 = abs(GEOD.geometry_area_perimeter(aoi)[0]) / 1e6
    if area_km2 > 400:
        raise AnalysisError(f"AOI is {area_km2:,.0f} km². Road network analysis supports up to 400 km².")
    buffer_m = _num(data, "buffer_m", 500, 50, 5000)
    w, s, e, n = aoi.bounds
    q = f'[out:json][timeout:90];way["highway"]({s},{w},{n},{e});out geom;'
    try:
        gj = osm_to_geojson(overpass(q))
    except Exception as exc:
        raise AnalysisError(f"OpenStreetMap (Overpass) did not respond: {exc}. Try again in a minute.")

    fwd, inv, epsg = _utm_transformers(aoi.centroid.x, aoi.centroid.y)
    aoi_utm = transform(fwd, aoi)
    by_class = {}
    kept = []
    lines_utm = []
    for f in gj["features"]:
        if f["geometry"]["type"] != "LineString":
            continue
        line = shape(f["geometry"]).intersection(aoi)
        if line.is_empty:
            continue
        cls = f["properties"].get("highway", "other")
        length_m = GEOD.geometry_length(line)
        by_class[cls] = by_class.get(cls, 0) + length_m
        f["geometry"] = mapping(line)
        f["properties"] = {"highway": cls, "name": f["properties"].get("name", ""),
                           "surface": f["properties"].get("surface", ""), "color": ROAD_COLORS.get(cls, "#64748b")}
        kept.append(f)
        lines_utm.append(transform(fwd, line))
    if not kept:
        raise AnalysisError("No OpenStreetMap roads found inside this AOI.")

    total_km = sum(by_class.values()) / 1000
    served = unary_union([l.buffer(buffer_m, resolution=4) for l in lines_utm]).intersection(aoi_utm)
    served_pct = 100 * served.area / aoi_utm.area if aoi_utm.area else 0
    served_wgs = transform(inv, served.simplify(10))
    rows = sorted(([k, round(v / 1000, 2), round(100 * v / 1000 / total_km, 1)] for k, v in by_class.items()),
                  key=lambda r: -r[1])
    return _ok(
        title="Road network analysis (OpenStreetMap)",
        vectors=[
            {"id": "road-buffer", "name": f"{int(buffer_m)} m service area", "type": "fill", "color": "#f97316",
             "opacity": 0.18, "data": {"type": "Feature", "properties": {}, "geometry": mapping(served_wgs)}},
            {"id": "roads", "name": "Roads", "type": "line", "colorProp": "color", "width": 2,
             "data": {"type": "FeatureCollection", "features": kept}},
        ],
        legend={"type": "classes", "items": [{"value": k, "label": k, "color": ROAD_COLORS.get(k, "#64748b")}
                                             for k, _ in sorted(by_class.items(), key=lambda kv: -kv[1])[:10]]},
        stats=[{"label": "Total road length", "value": round(total_km, 2), "unit": "km"},
               {"label": "Road density", "value": round(total_km / area_km2, 2), "unit": "km/km²"},
               {"label": f"Area within {int(buffer_m)} m of a road", "value": round(served_pct, 1), "unit": "%"},
               {"label": "Road segments", "value": len(kept), "unit": ""},
               {"label": "AOI area", "value": round(area_km2, 2), "unit": "km²"}],
        table={"title": "Length by road class", "columns": ["Class", "Length (km)", "Share (%)"], "rows": rows},
        chart={"title": "Length by road class (km)", "type": "bar", "xKey": "label", "yKey": "value", "unit": "km",
               "data": [{"label": r[0], "value": r[1]} for r in rows[:12]]},
        notes=["Source: OpenStreetMap via Overpass API. Coverage in rural Nepal can be incomplete — verify with DoR/DoLIDAR maps.",
               "Road density benchmarks: < 0.5 km/km² poorly connected; > 2 km/km² dense urban."],
    )


def _dist_to(mask, max_m=10000):
    """Euclidean distance (m) to the nearest pixel where mask==1, capped at max_m.

    Computed on a fixed grid: Earth Engine kernels are limited to 512 px, and
    a kernel given in metres would otherwise grow past that when map tiles
    are rendered at high zoom (small pixels)."""
    grid = max(90, max_m / 200)
    # distance() needs a 0/1 image (distance to nearest non-zero pixel) — a
    # self-masked input only yields values on the masked pixels themselves.
    return (mask.unmask(0).gt(0).distance(ee.Kernel.euclidean(max_m, "meters"))
            .reproject(crs="EPSG:4326", scale=grid).unmask(max_m).min(max_m))


def urban_suitability(data):
    roi, area = _roi(data, 3000)
    scale = _scale_for(area)
    w = _weights(data, {"slope": 35, "access": 25, "landcover": 20, "flood": 20})
    slope = _slope()
    s_slope = _score(slope, [5, 10, 15, 25], [5, 4, 3, 2, 1])
    built = ee.Image("JRC/GHSL/P2023A/GHS_BUILT_S/2020").select("built_surface").gte(500)
    s_access = _score(_dist_to(built, 8000), [500, 1500, 3000, 6000], [5, 4, 3, 2, 1])
    lc = _worldcover()
    s_lc = lc.remap([10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100], [1, 3, 4, 3, 5, 4, 0, 0, 0, 0, 2])
    occ = ee.Image("JRC/GSW1_4/GlobalSurfaceWater").select("occurrence").unmask(0)
    hand = ee.Image("MERIT/Hydro/v1_0_1").select("hnd")
    flood_prone = occ.gt(0).Or(hand.lt(3))
    s_flood = ee.Image(5).where(hand.lt(10), 4).where(hand.lt(5), 2).where(flood_prone, 1)
    index = (s_slope.multiply(w["slope"]).add(s_access.multiply(w["access"]))
             .add(s_lc.multiply(w["landcover"])).add(s_flood.multiply(w["flood"])))
    excluded = lc.eq(80).Or(lc.eq(70)).Or(lc.eq(90)).Or(slope.gt(35)).Or(occ.gt(50))
    cls = _classify5(index, [1.8, 2.6, 3.4, 4.2]).where(excluded, 1).clip(roi)
    layer, legend = _class_layer(cls, CLASS5_SUIT, roi, scale, "urban-suit", "Development suitability")
    rows = _rows_from_groups(_class_areas_expr(cls, roi, scale).getInfo(), CLASS5_SUIT)
    good = sum(r["area_km2"] for r in rows if r["code"] >= 4)
    return _ok(
        title="Site suitability for urban development (weighted overlay)",
        layers=[layer], legend=legend,
        stats=[{"label": "Suitable + highly suitable", "value": round(good, 2), "unit": f"km² ({round(100 * good / area, 1)}%)"},
               {"label": "Weights", "value": ", ".join(f"{k} {round(v * 100)}%" for k, v in w.items()), "unit": ""}],
        table={"title": "Area by suitability class", "columns": ["Class", "Area (km²)", "Share (%)"],
               "rows": [[r["label"], r["area_km2"], r["percent"]] for r in rows]},
        chart={"title": "Suitability classes (km²)", "type": "bar", "xKey": "label", "yKey": "area_km2", "unit": "km²",
               "data": rows},
        notes=["Criteria: slope (SRTM), distance to existing built-up (GHSL 2020 as access proxy), land cover (ESA WorldCover), "
               "flood proneness (JRC water history + MERIT HAND). Water, snow, wetlands, slopes > 35° and permanent water are excluded.",
               "Screening only — check land ownership, zoning bylaws, geology and access roads before selecting sites."],
    )


# ==========================================================================
# DISASTER RISK
# ==========================================================================

def _flood_index():
    hand = ee.Image("MERIT/Hydro/v1_0_1").select("hnd")
    occ = ee.Image("JRC/GSW1_4/GlobalSurfaceWater").select("occurrence").unmask(0)
    water = occ.gt(50)
    s_hand = _score(hand, [2, 5, 10, 20], [5, 4, 3, 2, 1])
    s_occ = ee.Image(1).where(occ.gt(0), 4).where(occ.gt(25), 5)
    s_dist = _score(_dist_to(water, 5000), [200, 500, 1000, 2000], [5, 4, 3, 2, 1])
    s_slope = _score(_slope(), [1, 3, 6, 10], [5, 4, 3, 2, 1])
    return s_hand.multiply(0.45).add(s_occ.multiply(0.2)).add(s_dist.multiply(0.2)).add(s_slope.multiply(0.15))


def _landslide_index(w):
    slope = _slope()
    s_slope = _score(slope, [10, 20, 30, 40], [1, 2, 3, 4, 5])
    relief = _dem().reduceNeighborhood(ee.Reducer.max().combine(ee.Reducer.min(), sharedInputs=True),
                                       ee.Kernel.square(5))
    rel = relief.select(0).subtract(relief.select(1)).reproject(crs="EPSG:4326", scale=90)
    s_relief = _score(rel, [50, 100, 200, 350], [1, 2, 3, 4, 5])
    streams = ee.Image("MERIT/Hydro/v1_0_1").select("upa").gt(1)
    s_stream = _score(_dist_to(streams, 3000), [100, 300, 600, 1200], [5, 4, 3, 2, 1])
    s_lc = _worldcover().remap([10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100], [1, 3, 4, 3, 3, 5, 2, 1, 1, 1, 3])
    rain = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY").filterDate("2014-01-01", "2024-01-01").sum().divide(10)
    s_rain = _score(rain, [1000, 1500, 2000, 2500], [1, 2, 3, 4, 5])
    clay = ee.Image("OpenLandMap/SOL/SOL_CLAY-WFRACTION_USDA-3A1A1A_M/v02").select("b0")
    s_soil = _score(clay, [15, 25, 35, 45], [1, 2, 3, 4, 5])
    return (s_slope.multiply(w["slope"]).add(s_relief.multiply(w["relief"])).add(s_stream.multiply(w["streams"]))
            .add(s_lc.multiply(w["landcover"])).add(s_rain.multiply(w["rainfall"])).add(s_soil.multiply(w["soil"])))


def _fire_index():
    y = date.today().year
    dry = ee.Filter.calendarRange(3, 5, "month")
    ndvi = ee.ImageCollection("MODIS/061/MOD13Q1").filterDate(f"{y - 5}-01-01", f"{y}-01-01").filter(dry).select("NDVI").mean().multiply(0.0001)
    lst = (ee.ImageCollection("MODIS/061/MOD11A2").filterDate(f"{y - 5}-01-01", f"{y}-01-01").filter(dry)
           .select("LST_Day_1km").mean().multiply(0.02).subtract(273.15))
    burns = ee.ImageCollection("MODIS/061/MCD64A1").filterDate("2001-01-01", f"{y}-01-01").select("BurnDate").map(lambda i: i.gt(0)).sum().unmask(0)
    aspect = ee.Terrain.aspect(_dem())
    south = aspect.gt(112.5).And(aspect.lt(247.5))
    tree = _worldcover()
    s_fuel = _score(ndvi, [0.2, 0.35, 0.5, 0.65], [1, 3, 5, 4, 3])
    s_lst = _score(lst, [20, 25, 30, 35], [1, 2, 3, 4, 5])
    s_hist = _score(burns, [1, 2, 4, 6], [1, 3, 4, 5, 5])
    s_slope = _score(_slope(), [10, 20, 30, 40], [1, 2, 3, 4, 5])
    s_aspect = ee.Image(2).where(south, 4)
    s_lc = tree.remap([10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100], [5, 5, 4, 2, 1, 1, 1, 1, 1, 1, 1])
    idx = (s_fuel.multiply(0.15).add(s_lst.multiply(0.15)).add(s_hist.multiply(0.3))
           .add(s_slope.multiply(0.1)).add(s_aspect.multiply(0.1)).add(s_lc.multiply(0.2)))
    return idx, burns


def _hazard_result(title, index, breaks, roi, area, scale, layer_id, notes, extra_stats=None, chart=None):
    cls = _classify5(index, breaks).clip(roi)
    layer, legend = _class_layer(cls, CLASS5, roi, scale, layer_id, title)
    payload = ee.Dictionary({"areas": _class_areas_expr(cls, roi, scale), "exp": _exposure_by_class(cls, roi, scale)}).getInfo()
    rows = _rows_from_groups(payload["areas"], CLASS5)
    exp = _exposure_rows(payload["exp"], CLASS5)
    hi = sum(r["area_km2"] for r in rows if r["code"] >= 4)
    pop_hi = sum(int(r[1].replace(",", "")) for r in exp[3:])
    stats = [{"label": "High + very high", "value": round(hi, 2), "unit": f"km² ({round(100 * hi / area, 1)}%)"},
             {"label": "People in high + very high", "value": f"{pop_hi:,}", "unit": f"(WorldPop {WORLDPOP_YEAR})"}]
    return _ok(
        title=title, layers=[layer], legend=legend, stats=stats + (extra_stats or []),
        table={"title": "Exposure by class", "columns": ["Class", "People", "Built-up (km²)", "Cropland (km²)"], "rows": exp},
        chart=chart or {"title": "Area by class (km²)", "type": "bar", "xKey": "label", "yKey": "area_km2", "unit": "km²", "data": rows},
        notes=notes,
    )


def disaster_flood(data):
    roi, area = _roi(data, 3000)
    scale = _scale_for(area)
    return _hazard_result(
        "Flood hazard & exposure", _flood_index(), [1.8, 2.6, 3.4, 4.2], roi, area, scale, "flood-risk",
        ["Index = 45% height above nearest drainage (MERIT HAND) + 20% historical water (JRC 1984–2021) + "
         "20% distance to rivers + 15% flatness.",
         "Use as screening for where to run HEC-RAS / detailed flood studies — not a regulatory flood map."])


def disaster_landslide(data):
    roi, area = _roi(data, 3000)
    scale = _scale_for(area)
    w = _weights(data, {"slope": 35, "relief": 15, "streams": 15, "landcover": 15, "rainfall": 10, "soil": 10})
    res = _hazard_result(
        "Landslide susceptibility", _landslide_index(w), [1.9, 2.5, 3.1, 3.7], roi, area, scale, "landslide",
        ["Heuristic weighted overlay: slope, local relief, distance to streams (MERIT), land cover (ESA), "
         "mean annual rainfall (CHIRPS 2014–2023), clay content (OpenLandMap).",
         "Validate with the Bipad landslide inventory and field mapping; geology/faults (DMG) are not included."])
    res["stats"].append({"label": "Weights", "value": ", ".join(f"{k} {round(v * 100)}%" for k, v in w.items()), "unit": ""})
    return res


def disaster_wildfire(data):
    roi, area = _roi(data, 5000)
    scale = _scale_for(area, 100)
    idx, burns = _fire_index()
    y1 = date.today().year - 1
    years = list(range(2001, y1 + 1))
    burned = ee.ImageCollection("MODIS/061/MCD64A1").select("BurnDate")
    per_year = ee.FeatureCollection([
        ee.Feature(None, {"year": y, "km2": burned.filterDate(f"{y}-01-01", f"{y + 1}-01-01").max().gt(0)
                          .multiply(ee.Image.pixelArea()).divide(1e6)
                          .reduceRegion(ee.Reducer.sum(), roi, 500, maxPixels=1e9, bestEffort=True).get("BurnDate")})
        for y in years
    ]).getInfo()["features"]
    series = [{"label": str(f["properties"]["year"]), "value": round(f["properties"].get("km2") or 0, 2)} for f in per_year]
    firms = ee.ImageCollection("FIRMS").filterDate(f"{y1}-01-01", f"{y1 + 1}-01-01").select("T21").count()
    hotspot_px = firms.gt(0).reduceRegion(ee.Reducer.sum(), roi, 1000, maxPixels=1e9, bestEffort=True).get("T21").getInfo() or 0
    total_burn = sum(s["value"] for s in series)
    return _hazard_result(
        "Wildfire susceptibility", idx, [1.9, 2.5, 3.1, 3.7], roi, area, scale, "wildfire",
        ["Index: burn history (MODIS MCD64A1 2001–present, 30%), land cover fuel (20%), pre-monsoon NDVI & land surface temperature "
         "(Mar–May, 30%), slope and south-facing aspect (20%).",
         "Nepal's fire season peaks March–May; forests in the Chure/Siwalik and mid-hills are most affected."],
        extra_stats=[{"label": "Burned area 2001–" + str(y1), "value": round(total_burn, 1), "unit": "km² (cumulative)"},
                     {"label": f"Active-fire cells {y1}", "value": int(hotspot_px), "unit": "1-km cells (FIRMS)"}],
        chart={"title": "Burned area per year (km², MODIS)", "type": "bar", "xKey": "label", "yKey": "value", "unit": "km²", "data": series})


def disaster_earthquake(data):
    roi, area = _roi(data, 20000)
    radius = _num(data, "radius_km", 150, 20, 500)
    min_mag = _num(data, "min_mag", 4.0, 2.5, 7)
    lng, lat = roi.centroid(maxError=10).coordinates().getInfo()
    params = urllib.parse.urlencode({
        "format": "geojson", "latitude": lat, "longitude": lng, "maxradiuskm": radius,
        "minmagnitude": min_mag, "starttime": "1900-01-01", "orderby": "magnitude", "limit": 5000,
    })
    try:
        with urllib.request.urlopen(f"https://earthquake.usgs.gov/fdsnws/event/1/query?{params}", timeout=60) as r:
            quakes = json.loads(r.read().decode())
    except Exception as exc:
        raise AnalysisError(f"USGS earthquake catalogue did not respond: {exc}")
    feats = quakes.get("features", [])
    pts = []
    mags = []
    for f in feats:
        p = f["properties"]
        m = p.get("mag")
        if m is None:
            continue
        mags.append((m, p.get("time"), p.get("place"), f["geometry"]["coordinates"]))
        color = "#fde047" if m < 5 else "#fb923c" if m < 6 else "#ef4444" if m < 7 else "#7f1d1d"
        pts.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": f["geometry"]["coordinates"][:2]},
                    "properties": {"mag": m, "place": p.get("place"), "depth_km": f["geometry"]["coordinates"][2],
                                   "date": _ms_to_date(p["time"]).isoformat() if p.get("time") is not None else "",
                                   "color": color, "radius": 3 + (m - min_mag) * 3}})
    if not mags:
        raise AnalysisError("No earthquakes found for this radius and magnitude. Increase the radius or lower the magnitude.")

    bins = [x / 2 for x in range(int(min_mag * 2), 17)]
    hist = [{"label": f"M{b:.1f}", "value": sum(1 for m in mags if b <= m[0] < b + 0.5)} for b in bins]
    hist = [h for h in hist if h["value"] > 0]
    first_year = min(_ms_to_date(m[1]).year for m in mags if m[1] is not None)
    span = max(1, date.today().year - max(first_year, 1973))  # instrumental catalogue is ~complete for M4.5+ since 1973
    gr = []
    for b in [x / 2 for x in range(int(min_mag * 2), 17)]:
        n = sum(1 for m in mags if m[0] >= b and _ms_to_date(m[1]).year >= 1973)
        if n:
            gr.append({"label": f"≥{b:.1f}", "value": round(n / span, 3)})
    biggest = max(mags, key=lambda m: m[0])
    exp = ee.Dictionary({
        "pop": _worldpop().reduceRegion(ee.Reducer.sum(), roi, 92.77, maxPixels=1e10, bestEffort=True).get("population"),
        "built": ee.Image("JRC/GHSL/P2023A/GHS_BUILT_S/2020").select("built_surface")
                   .reduceRegion(ee.Reducer.sum(), roi, 100, maxPixels=1e10, bestEffort=True).get("built_surface"),
    }).getInfo()
    notes = [f"Events within {int(radius)} km of the AOI centre from the USGS ComCat catalogue (M ≥ {min_mag}). "
             "Circle size and colour scale with magnitude.",
             "Annual-rate chart (Gutenberg–Richter) uses events since 1973; smaller magnitudes are under-recorded in older data."]
    if _nepal_note(roi):
        notes.append("Nepal: design to NBC 105:2020 — seismic zoning factor Z = 0.25–0.40 depending on municipality. "
                     "The 2015 Gorkha earthquake was Mw 7.8.")
    return _ok(
        title="Earthquake hazard (historical seismicity + exposure)",
        vectors=[{"id": "quakes", "name": "Earthquakes", "type": "circle", "colorProp": "color", "radiusProp": "radius",
                  "data": {"type": "FeatureCollection", "features": pts}}],
        legend={"type": "classes", "items": [{"value": 1, "label": "M < 5", "color": "#fde047"},
                                             {"value": 2, "label": "M 5–6", "color": "#fb923c"},
                                             {"value": 3, "label": "M 6–7", "color": "#ef4444"},
                                             {"value": 4, "label": "M ≥ 7", "color": "#7f1d1d"}]},
        stats=[{"label": "Events found", "value": len(mags), "unit": f"(M ≥ {min_mag}, {int(radius)} km)"},
               {"label": "Largest", "value": f"M{biggest[0]}", "unit": f"{_ms_to_date(biggest[1]).year if biggest[1] is not None else ''} · {biggest[2]}"},
               {"label": "M ≥ 6 events", "value": sum(1 for m in mags if m[0] >= 6), "unit": ""},
               {"label": "Population in AOI", "value": f"{int(exp.get('pop') or 0):,}", "unit": "(WorldPop est.)"},
               {"label": "Built-up in AOI", "value": round((exp.get("built") or 0) / 1e6, 2), "unit": "km²"}],
        table={"title": "Largest 15 events", "columns": ["Mag", "Date", "Depth (km)", "Place"],
               "rows": [[m[0], _ms_to_date(m[1]).isoformat() if m[1] is not None else "", round(m[3][2], 1), m[2]]
                        for m in sorted(mags, key=lambda m: -m[0])[:15]]},
        chart={"title": "Annual rate of events ≥ magnitude (since 1973)", "type": "bar", "xKey": "label", "yKey": "value",
               "unit": "events/yr", "data": gr or hist},
        notes=notes,
    )


def disaster_multi(data):
    roi, area = _roi(data, 3000)
    scale = _scale_for(area, 60)
    w = _weights(data, {"flood": 35, "landslide": 40, "wildfire": 25})
    ls = _landslide_index({"slope": .35, "relief": .15, "streams": .15, "landcover": .15, "rainfall": .1, "soil": .1})
    fire, _ = _fire_index()
    idx = _flood_index().multiply(w["flood"]).add(ls.multiply(w["landslide"])).add(fire.multiply(w["wildfire"]))
    res = _hazard_result(
        "Multi-hazard index", idx, [1.9, 2.4, 2.9, 3.4], roi, area, scale, "multi-hazard",
        ["Combines the flood, landslide and wildfire indices (each scored 1–5) with your weights.",
         "Earthquake hazard is regional (similar across a municipality), so it isn't mixed in — run Earthquake Assessment separately."])
    res["stats"].append({"label": "Weights", "value": ", ".join(f"{k} {round(v * 100)}%" for k, v in w.items()), "unit": ""})
    return res


def _s1_flood(roi, pre_start, pre_end, post_start, post_end, diff_db=3):
    s1 = (ee.ImageCollection("COPERNICUS/S1_GRD").filterBounds(roi)
          .filter(ee.Filter.eq("instrumentMode", "IW"))
          .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV")).select("VV"))
    pre = s1.filterDate(pre_start, pre_end)
    post = s1.filterDate(post_start, post_end)
    if pre.size().getInfo() == 0 or post.size().getInfo() == 0:
        raise AnalysisError("No Sentinel-1 images for one of the periods. Widen the date ranges (at least 12 days each).")
    sm = lambda img: img.focal_median(30, "circle", "meters")
    before = sm(pre.median())
    after = sm(post.median())
    flood = after.subtract(before).lt(-diff_db).And(after.lt(-15))
    perm = ee.Image("JRC/GSW1_4/GlobalSurfaceWater").select("seasonality").unmask(0).gte(10)
    flood = flood.updateMask(perm.Not()).updateMask(_slope().lt(5)).updateMask(ee.Image("MERIT/Hydro/v1_0_1").select("hnd").lt(20))
    return flood.selfMask().clip(roi)


def disaster_impact(data):
    roi, area = _roi(data, 2000)
    pre_s, pre_e = data.get("pre_start"), data.get("pre_end")
    post_s, post_e = data.get("post_start"), data.get("post_end")
    if not all([pre_s, pre_e, post_s, post_e]):
        raise AnalysisError("Enter the before-event and after-event date ranges.")
    flood = _s1_flood(roi, pre_s, pre_e, post_s, post_e, _num(data, "threshold_db", 3, 1, 6))
    px = ee.Image.pixelArea().divide(1e6)
    payload = {
        "flood_km2": px.updateMask(flood).reduceRegion(ee.Reducer.sum(), roi, 20, maxPixels=1e10, bestEffort=True).get("area"),
        "people": _worldpop().multiply(flood.unmask(0)).reduceRegion(
            ee.Reducer.sum(), roi, 92.77, maxPixels=1e10, bestEffort=True).get("population"),
        "crop_km2": px.updateMask(flood.And(_worldcover().eq(40))).reduceRegion(ee.Reducer.sum(), roi, 20, maxPixels=1e10, bestEffort=True).get("area"),
        "built_km2": px.updateMask(flood.And(_worldcover().eq(50))).reduceRegion(ee.Reducer.sum(), roi, 20, maxPixels=1e10, bestEffort=True).get("area"),
    }
    if area <= 200:
        bld = ee.FeatureCollection("GOOGLE/Research/open-buildings/v3/polygons").filterBounds(roi).filter(ee.Filter.gte("confidence", 0.7))
        hit = flood.unmask(0).reduceRegions(bld.map(lambda f: f.centroid(1)), ee.Reducer.first(), 10).filter(ee.Filter.eq("first", 1))
        payload["buildings"] = hit.size()
        payload["buildings_total"] = bld.size()
    r = ee.Dictionary(payload).getInfo()
    url = _tile(flood, {"palette": ["#1d4ed8"]})
    stats = [{"label": "Flooded area", "value": round(r.get("flood_km2") or 0, 3), "unit": "km²"},
             {"label": "People affected (est.)", "value": f"{int(r.get('people') or 0):,}", "unit": f"WorldPop {WORLDPOP_YEAR}"},
             {"label": "Cropland flooded", "value": round(r.get("crop_km2") or 0, 3), "unit": "km²"},
             {"label": "Built-up flooded", "value": round(r.get("built_km2") or 0, 3), "unit": "km²"}]
    if "buildings" in r:
        stats.append({"label": "Buildings in flood", "value": f"{r['buildings']:,}", "unit": f"of {r['buildings_total']:,} (Open Buildings)"})
    return _ok(
        title="Flood event impact (Sentinel-1 change detection)",
        layers=[{"layerId": "impact-flood", "name": "Flood extent", "visual_url": url, "opacity": 0.85,
                 "download_url": _download(flood.unmask(0).toByte(), roi, 20)}],
        legend={"type": "classes", "items": [{"value": 1, "label": "Newly flooded", "color": "#1d4ed8"}]},
        stats=stats,
        table={"title": "Impact summary", "columns": ["Indicator", "Value", "Unit"], "rows": [[s["label"], s["value"], s["unit"]] for s in stats]},
        notes=["Flood = VV backscatter drop > threshold and after-image < −15 dB; permanent water, slopes > 5° and HAND > 20 m removed.",
               "Radar misses flooding under dense trees and in narrow urban streets — treat counts as minimum estimates."],
    )


# ==========================================================================
# AGRICULTURE
# ==========================================================================

# Approximate FAO ECOCROP-style requirements (annual means). opt = optimal, abs = absolute limits.
CROPS = {
    "rice":      {"name": "Rice (paddy)", "temp": (20, 30, 13, 36), "rain": (1000, 2500, 700, 4000), "elev": (0, 2400), "slope": 15, "ph": (5.0, 7.5, 4.5, 8.2)},
    "maize":     {"name": "Maize", "temp": (18, 30, 10, 38), "rain": (600, 1500, 400, 2800), "elev": (0, 3000), "slope": 25, "ph": (5.5, 7.5, 5.0, 8.5)},
    "wheat":     {"name": "Wheat", "temp": (12, 23, 5, 28), "rain": (400, 1100, 250, 1800), "elev": (0, 3500), "slope": 15, "ph": (6.0, 7.5, 5.0, 8.5)},
    "millet":    {"name": "Finger millet", "temp": (18, 27, 10, 35), "rain": (600, 1300, 400, 2200), "elev": (0, 3000), "slope": 30, "ph": (5.0, 7.5, 4.5, 8.2)},
    "potato":    {"name": "Potato", "temp": (12, 20, 5, 26), "rain": (500, 1200, 300, 2200), "elev": (0, 4000), "slope": 25, "ph": (5.0, 6.5, 4.5, 7.5)},
    "tea":       {"name": "Tea", "temp": (18, 25, 13, 30), "rain": (1500, 3000, 1100, 5000), "elev": (0, 2200), "slope": 35, "ph": (4.5, 5.5, 4.0, 6.5)},
    "coffee":    {"name": "Coffee (arabica)", "temp": (18, 23, 15, 28), "rain": (1400, 2300, 1000, 3200), "elev": (600, 1800), "slope": 30, "ph": (5.0, 6.5, 4.5, 7.5)},
    "sugarcane": {"name": "Sugarcane", "temp": (22, 30, 16, 38), "rain": (1100, 2500, 800, 4000), "elev": (0, 1500), "slope": 10, "ph": (6.0, 7.5, 5.0, 8.5)},
    "cardamom":  {"name": "Large cardamom", "temp": (15, 22, 10, 26), "rain": (1500, 3000, 1200, 4500), "elev": (700, 2200), "slope": 35, "ph": (4.5, 6.5, 4.0, 7.0)},
}


def _range_score(img, opt_lo, opt_hi, abs_lo, abs_hi):
    """3 = optimal, 2 = marginal (within absolute limits), 0 = unsuitable."""
    return (ee.Image(0).where(img.gte(abs_lo).And(img.lte(abs_hi)), 2)
            .where(img.gte(opt_lo).And(img.lte(opt_hi)), 3))


def agri_crop(data):
    roi, area = _roi(data, 5000)
    scale = _scale_for(area, 90)
    crop_id = data.get("crop", "rice")
    c = CROPS.get(crop_id)
    if not c:
        raise AnalysisError("Unknown crop.")
    temp = ee.ImageCollection("ECMWF/ERA5_LAND/MONTHLY_AGGR").filterDate("2014-01-01", "2024-01-01").select("temperature_2m").mean().subtract(273.15)
    # ERA5-Land is 11 km; correct for local elevation with a 6.5 °C/km lapse rate so valleys and ridges differ.
    # Two-step aggregation (30 m -> 1 km -> 11 km) keeps each step under EE's 65,535-pixel limit.
    dem_1km = _dem().reduceResolution(ee.Reducer.mean(), maxPixels=4096).reproject(crs="EPSG:4326", scale=1000)
    era_proj = ee.ImageCollection("ECMWF/ERA5_LAND/MONTHLY_AGGR").first().projection()  # a composite's own projection is 1°
    era_elev = dem_1km.reduceResolution(ee.Reducer.mean(), maxPixels=4096).reproject(era_proj)
    temp_local = temp.subtract(_dem().subtract(era_elev).multiply(0.0065))
    rain = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY").filterDate("2014-01-01", "2024-01-01").sum().divide(10)
    ph = ee.Image("OpenLandMap/SOL/SOL_PH-H2O_USDA-4C1A2A_M/v02").select("b0").divide(10)
    elev = _dem()
    slope = _slope()
    s_t = _range_score(temp_local, *c["temp"])
    s_r = _range_score(rain, *c["rain"])
    s_p = _range_score(ph, *c["ph"])
    s_e = ee.Image(0).where(elev.gte(c["elev"][0]).And(elev.lte(c["elev"][1])), 3)
    s_s = ee.Image(0).where(slope.lte(c["slope"] * 1.5), 2).where(slope.lte(c["slope"]), 3)
    limiting = s_t.min(s_r).min(s_p).min(s_e).min(s_s)   # FAO "law of the minimum"
    n_opt = s_t.eq(3).add(s_r.eq(3)).add(s_p.eq(3)).add(s_e.eq(3)).add(s_s.eq(3))
    lc = _worldcover()
    farmable = lc.eq(40).Or(lc.eq(30)).Or(lc.eq(20)).Or(lc.eq(60))
    if data.get("include_forest") in (True, "true", "1", 1):
        farmable = farmable.Or(lc.eq(10))
    cls = (ee.Image(1).where(limiting.eq(2), 2).where(limiting.eq(2).And(n_opt.gte(4)), 3)
           .where(limiting.eq(3), 4).updateMask(farmable).clip(roi))
    classes = [(1, "N — not suitable", "#d7191c"), (2, "S3 — marginal", "#fdae61"),
               (3, "S2 — moderately suitable", "#a6d96a"), (4, "S1 — highly suitable", "#1a9641")]
    layer, legend = _class_layer(cls, classes, roi, scale, "crop-suit", f"{c['name']} suitability")
    fail = {k: v.lt(2).updateMask(farmable) for k, v in {"Temperature": s_t, "Rainfall": s_r, "Soil pH": s_p, "Elevation": s_e, "Slope": s_s}.items()}
    payload = ee.Dictionary({
        "areas": _class_areas_expr(cls, roi, scale),
        "means": ee.Image.cat([temp_local.rename("t"), rain.rename("r"), ph.rename("p"), elev.rename("e"), slope.rename("s")])
                   .updateMask(farmable).reduceRegion(ee.Reducer.mean(), roi, scale, maxPixels=1e10, bestEffort=True),
        "fail": ee.Image.cat([v.rename(k) for k, v in fail.items()]).reduceRegion(ee.Reducer.mean(), roi, scale, maxPixels=1e10, bestEffort=True),
    }).getInfo()
    rows = _rows_from_groups(payload["areas"], classes)
    m = payload["means"]
    good = sum(r["area_km2"] for r in rows if r["code"] >= 3)
    return _ok(
        title=f"Crop suitability — {c['name']}",
        layers=[layer], legend=legend,
        stats=[{"label": "S1 + S2 land", "value": round(good, 2), "unit": "km²"},
               {"label": "Farmable land assessed", "value": round(sum(r["area_km2"] for r in rows), 2), "unit": "km²"}],
        table={"title": "Site conditions vs crop requirements", "columns": ["Factor", "AOI mean (farmland)", "Optimal", "Limit", "Farmland failing (%)"],
               "rows": [["Temperature (°C)", round(m.get("t") or 0, 1), f"{c['temp'][0]}–{c['temp'][1]}", f"{c['temp'][2]}–{c['temp'][3]}", round(100 * (payload['fail'].get('Temperature') or 0), 1)],
                        ["Rainfall (mm/yr)", round(m.get("r") or 0), f"{c['rain'][0]}–{c['rain'][1]}", f"{c['rain'][2]}–{c['rain'][3]}", round(100 * (payload['fail'].get('Rainfall') or 0), 1)],
                        ["Soil pH", round(m.get("p") or 0, 1), f"{c['ph'][0]}–{c['ph'][1]}", f"{c['ph'][2]}–{c['ph'][3]}", round(100 * (payload['fail'].get('Soil pH') or 0), 1)],
                        ["Elevation (m)", round(m.get("e") or 0), f"{c['elev'][0]}–{c['elev'][1]}", "—", round(100 * (payload['fail'].get('Elevation') or 0), 1)],
                        ["Slope (°)", round(m.get("s") or 0, 1), f"≤ {c['slope']}", f"≤ {c['slope'] * 1.5:g}", round(100 * (payload['fail'].get('Slope') or 0), 1)]]},
        chart={"title": "Area by suitability class (km²)", "type": "bar", "xKey": "label", "yKey": "area_km2", "unit": "km²", "data": rows},
        notes=["FAO-style land evaluation: each factor scored optimal / marginal / unsuitable; the worst factor limits the class.",
               "Climate: ERA5-Land 2014–2023 (lapse-rate corrected to the 30 m DEM) and CHIRPS rainfall. Crop ranges are approximate (ECOCROP) — irrigation can overcome rainfall limits.",
               "Only cropland, grassland, shrubland and bare land are assessed (forest optional)."],
    )


def agri_soil(data):
    roi, area = _roi(data, 5000)
    scale = 250
    sg = lambda name, band: ee.Image(f"projects/soilgrids-isric/{name}_mean").select(band)
    soc = sg("soc", "soc_0-5cm_mean").divide(10)          # dg/kg -> g/kg
    nit = sg("nitrogen", "nitrogen_0-5cm_mean").divide(100)  # cg/kg -> g/kg
    cec = sg("cec", "cec_0-5cm_mean").divide(10)          # mmol(c)/kg -> cmol(c)/kg
    ph = sg("phh2o", "phh2o_0-5cm_mean").divide(10)
    bd = sg("bdod", "bdod_0-5cm_mean").divide(100)        # cg/cm3 -> g/cm3
    clay = ee.Image("OpenLandMap/SOL/SOL_CLAY-WFRACTION_USDA-3A1A1A_M/v02").select("b0")
    s_soc = _score(soc, [5, 10, 20, 30], [1, 2, 3, 4, 5])
    s_n = _score(nit, [0.5, 1, 1.5, 2.5], [1, 2, 3, 4, 5])
    s_cec = _score(cec, [5, 10, 15, 25], [1, 2, 3, 4, 5])
    s_ph = ee.Image(1).where(ph.gte(4.5), 2).where(ph.gte(5.0), 3).where(ph.gte(5.5), 5).where(ph.gt(7.5), 3).where(ph.gt(8.2), 1)
    idx = s_soc.multiply(0.3).add(s_n.multiply(0.25)).add(s_cec.multiply(0.25)).add(s_ph.multiply(0.2))
    cls = _classify5(idx, [1.8, 2.6, 3.4, 4.2]).clip(roi)
    classes = [(1, "Very low fertility", "#8c510a"), (2, "Low", "#d8b365"), (3, "Medium", "#f6e8c3"),
               (4, "High", "#5ab4ac"), (5, "Very high", "#01665e")]
    layer, legend = _class_layer(cls, classes, roi, scale, "soil-fert", "Soil fertility index")
    payload = ee.Dictionary({
        "areas": _class_areas_expr(cls, roi, scale),
        "stats": ee.Image.cat([soc.rename("soc"), nit.rename("n"), cec.rename("cec"), ph.rename("ph"), bd.rename("bd"), clay.rename("clay")])
                   .reduceRegion(ee.Reducer.mean().combine(ee.Reducer.minMax(), sharedInputs=True), roi, scale, maxPixels=1e10, bestEffort=True),
    }).getInfo()
    st = payload["stats"]
    rows = _rows_from_groups(payload["areas"], classes)
    g = lambda k, suf: st.get(f"{k}_{suf}")
    recs = []
    if (g("ph", "mean") or 7) < 5.5:
        recs.append("Acidic soil (pH < 5.5): apply agricultural lime; test exchangeable acidity for dose.")
    if (g("ph", "mean") or 7) > 7.8:
        recs.append("Alkaline soil (pH > 7.8): use acid-forming fertilisers, organic matter; watch zinc/iron deficiency.")
    if (g("soc", "mean") or 20) < 10:
        recs.append("Low organic carbon (< 1%): add compost/FYM, crop residues, green manure (dhaincha), reduce tillage.")
    if (g("n", "mean") or 2) < 1:
        recs.append("Low total nitrogen: split urea application, include legumes (lentil, soybean) in rotation.")
    if (g("cec", "mean") or 20) < 10:
        recs.append("Low CEC: nutrients leach easily — apply fertiliser in smaller, more frequent doses and build organic matter.")
    if not recs:
        recs.append("No major limitation detected at this scale — confirm with a laboratory soil test (NARC / soil lab).")
    fmt = lambda k, nd=2: f"{round(g(k, 'mean') or 0, nd)} ({round(g(k, 'min') or 0, nd)}–{round(g(k, 'max') or 0, nd)})"
    return _ok(
        title="Soil fertility assessment (SoilGrids 250 m, topsoil 0–5 cm)",
        layers=[layer], legend=legend,
        stats=[{"label": "Organic carbon", "value": round(g("soc", "mean") or 0, 1), "unit": "g/kg"},
               {"label": "Total nitrogen", "value": round(g("n", "mean") or 0, 2), "unit": "g/kg"},
               {"label": "CEC", "value": round(g("cec", "mean") or 0, 1), "unit": "cmol(c)/kg"},
               {"label": "pH (H₂O)", "value": round(g("ph", "mean") or 0, 2), "unit": ""}],
        table={"title": "Soil properties — mean (min–max)", "columns": ["Property", "Value", "Unit"],
               "rows": [["Organic carbon", fmt("soc", 1), "g/kg"], ["Total nitrogen", fmt("n"), "g/kg"],
                        ["Cation exchange capacity", fmt("cec", 1), "cmol(c)/kg"], ["pH (water)", fmt("ph"), ""],
                        ["Bulk density", fmt("bd"), "g/cm³"], ["Clay", fmt("clay", 1), "%"]]},
        chart={"title": "Area by fertility class (km²)", "type": "bar", "xKey": "label", "yKey": "area_km2", "unit": "km²", "data": rows},
        notes=recs + ["Fertility index = organic carbon 30% + nitrogen 25% + CEC 25% + pH 20%. SoilGrids are model predictions (~250 m) — use for planning, not fertiliser dosing.",
                      "SoilGrids total nitrogen has wide uncertainty and often reads high in mountain soils — confirm N with a laboratory test before planning fertiliser."],
    )


def agri_irrigation(data):
    roi, area = _roi(data, 3000)
    year = _year(data, lo=2017)
    scale = _scale_for(area, 20)
    s2 = (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED").filterBounds(roi)
          .filterDate(f"{year}-02-01", f"{year}-04-30").filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30)))
    if s2.size().getInfo() == 0:
        raise AnalysisError("No clear Sentinel-2 images in Feb–Apr for that year.")
    ndvi_dry = s2.map(lambda i: i.normalizedDifference(["B8", "B4"])).reduce(ee.Reducer.percentile([85]))
    crop = _worldcover().eq(40)
    thr = _num(data, "ndvi_threshold", 0.45, 0.2, 0.8)
    cls = ee.Image(1).where(ndvi_dry.gte(thr), 2).updateMask(crop).clip(roi)
    classes = [(1, "Rainfed / fallow in dry season", "#f4a261"), (2, "Green in dry season (likely irrigated)", "#2a9d8f")]
    layer, legend = _class_layer(cls, classes, roi, scale, "irrigation", "Irrigation status")
    water = ee.Image("JRC/GSW1_4/GlobalSurfaceWater").select("occurrence").unmask(0).gt(50).Or(ee.Image("MERIT/Hydro/v1_0_1").select("upa").gt(50))
    dist = _dist_to(water, 10000)
    payload = ee.Dictionary({
        "areas": _class_areas_expr(cls, roi, scale),
        "dist": dist.updateMask(cls.eq(1)).reduceRegion(ee.Reducer.percentile([50]), roi, 90, maxPixels=1e10, bestEffort=True),
        "near": ee.Image.pixelArea().divide(1e6).updateMask(cls.eq(1).And(dist.lt(1000))).reduceRegion(ee.Reducer.sum(), roi, scale, maxPixels=1e10, bestEffort=True),
    }).getInfo()
    rows = _rows_from_groups(payload["areas"], classes)
    irr, rain = rows[1]["area_km2"], rows[0]["area_km2"]
    total = irr + rain
    return _ok(
        title=f"Irrigation coverage {year} (dry-season greenness)",
        layers=[layer], legend=legend,
        stats=[{"label": "Cropland", "value": round(total, 2), "unit": "km²"},
               {"label": "Likely irrigated", "value": round(irr, 2), "unit": f"km² ({round(100 * irr / total, 1) if total else 0}%)"},
               {"label": "Rainfed / fallow", "value": round(rain, 2), "unit": "km²"},
               {"label": "Rainfed land < 1 km from river/water", "value": round(list(payload["near"].values())[0] or 0, 2),
                "unit": "km² — candidate for irrigation extension"}],
        table={"title": "Irrigation status", "columns": ["Class", "Area (km²)", "Share (%)"], "rows": [[r["label"], r["area_km2"], r["percent"]] for r in rows]},
        chart={"title": "Cropland by irrigation status (km²)", "type": "bar", "xKey": "label", "yKey": "area_km2", "unit": "km²", "data": rows},
        notes=[f"Cropland (ESA WorldCover) that stays green (85th-percentile NDVI ≥ {thr}) in the dry season Feb–Apr {year} is flagged as likely irrigated "
               "(winter wheat/vegetables need irrigation then).",
               "Compare with DWRI command-area maps; forests or orchards mapped as cropland can appear 'irrigated'."],
    )


def agri_risk(data):
    roi, area = _roi(data, 5000)
    year = _year(data, lo=2002)
    m0 = int(_num(data, "month_start", 6, 1, 12))
    m1 = int(_num(data, "month_end", 9, 1, 12))
    season = ee.Filter.calendarRange(m0, m1, "month")
    ndvi = ee.ImageCollection("MODIS/061/MOD13Q1").select("NDVI").filter(season)
    base = ndvi.filterDate("2001-01-01", "2021-01-01")
    nmin = base.min()
    nmax = base.max()
    cur = ndvi.filterDate(f"{year}-01-01", f"{year + 1}-01-01").mean()
    vci = cur.subtract(nmin).divide(nmax.subtract(nmin)).multiply(100)
    crop = _worldcover().eq(40)
    cls = (ee.Image(4).where(vci.lt(50), 3).where(vci.lt(35), 2).where(vci.lt(20), 1)).updateMask(crop).clip(roi)
    classes = [(1, "Severe drought (VCI < 20)", "#b2182b"), (2, "Moderate (20–35)", "#ef8a62"),
               (3, "Mild (35–50)", "#fddbc7"), (4, "Normal (≥ 50)", "#4dac26")]
    layer, legend = _class_layer(cls, classes, roi, 250, "agri-risk", f"Vegetation condition {year}")
    chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY").select("precipitation").filter(season)
    yrs = list(range(max(2001, year - 14), year + 1))
    rain_series = ee.FeatureCollection([
        ee.Feature(None, {"y": y, "mm": chirps.filterDate(f"{y}-01-01", f"{y + 1}-01-01").sum()
                          .reduceRegion(ee.Reducer.mean(), roi.buffer(3000), 5566, maxPixels=1e9, bestEffort=True).get("precipitation")})
        for y in yrs])
    normal = chirps.filterDate("1991-01-01", "2021-01-01").sum().divide(30).reduceRegion(
        ee.Reducer.mean(), roi.buffer(3000), 5566, maxPixels=1e9, bestEffort=True).get("precipitation")
    occ = ee.Image("JRC/GSW1_4/GlobalSurfaceWater").select("occurrence").unmask(0)
    payload = ee.Dictionary({
        "areas": _class_areas_expr(cls, roi, 250),
        "series": rain_series.aggregate_array("mm"),
        "normal": normal,
        "flood_crop": ee.Image.pixelArea().divide(1e6).updateMask(crop.And(occ.gt(0))).reduceRegion(ee.Reducer.sum(), roi, 30, maxPixels=1e10, bestEffort=True).get("area"),
    }).getInfo()
    rows = _rows_from_groups(payload["areas"], classes)
    series = [{"label": str(y), "value": round(v or 0)} for y, v in zip(yrs, payload["series"])]
    this = series[-1]["value"]
    normal_mm = payload["normal"] or 0
    anomaly = round(100 * (this - normal_mm) / normal_mm, 1) if normal_mm else None
    stressed = sum(r["area_km2"] for r in rows if r["code"] <= 2)
    return _ok(
        title=f"Agricultural risk — drought & flood ({year}, months {m0}–{m1})",
        layers=[layer], legend=legend,
        stats=[{"label": "Seasonal rainfall", "value": this, "unit": "mm"},
               {"label": "Normal (1991–2020)", "value": round(normal_mm), "unit": "mm"},
               {"label": "Rainfall anomaly", "value": anomaly, "unit": "%"},
               {"label": "Cropland under moderate/severe stress", "value": round(stressed, 2), "unit": "km²"},
               {"label": "Cropland in historical flood zone", "value": round(payload.get("flood_crop") or 0, 2), "unit": "km² (JRC water history)"}],
        table={"title": "Vegetation Condition Index on cropland", "columns": ["Class", "Area (km²)", "Share (%)"],
               "rows": [[r["label"], r["area_km2"], r["percent"]] for r in rows]},
        chart={"title": f"Seasonal rainfall (months {m0}–{m1}) by year, mm", "type": "bar", "xKey": "label", "yKey": "value", "unit": "mm", "data": series},
        notes=["VCI compares this season's MODIS NDVI with the 2001–2020 range for the same months (Kogan). VCI < 35 indicates drought stress.",
               "Rainfall: CHIRPS. A negative anomaly with low VCI confirms agricultural drought; low VCI with normal rain may mean pests, flood or late planting."],
    )


# ==========================================================================
# HYDROLOGY (drainage network, river corridor)
# ==========================================================================

def hydro_drainage(data):
    roi, area = _roi(data, 10000)
    thr = _num(data, "threshold_km2", 1, 0.1, 500)
    merit = ee.Image("MERIT/Hydro/v1_0_1")
    streams = merit.select("upa").gte(thr).selfMask().clip(roi)
    url = _tile(streams, {"palette": ["#1d4ed8"]})
    rivers = ee.FeatureCollection("WWF/HydroSHEDS/v1/FreeFlowingRivers").filterBounds(roi)
    n = rivers.size().getInfo()
    vec = None
    rows = []
    by_order = {}
    total_len = 0
    if n and n <= 3000:
        fc = rivers.map(lambda f: f.intersection(roi, 30).select(["RIV_ORD", "UPLAND_SKM", "DIS_AV_CMS", "LENGTH_KM", "BB_NAME"])).getInfo()
        feats = []
        for f in fc["features"]:
            g = f.get("geometry")
            if not g:
                continue
            p = f["properties"]
            L = GEOD.geometry_length(shape(g)) / 1000
            total_len += L
            order = int(p.get("RIV_ORD") or 0)
            by_order.setdefault(order, [0, 0, 0])
            by_order[order][0] += L
            by_order[order][1] += 1
            by_order[order][2] = max(by_order[order][2], p.get("DIS_AV_CMS") or 0)
            width = max(1, 8 - order)
            feats.append({"type": "Feature", "geometry": g,
                          "properties": {"order": order, "discharge_m3s": p.get("DIS_AV_CMS"), "upland_km2": p.get("UPLAND_SKM"),
                                         "basin": p.get("BB_NAME"), "width": width}})
        vec = {"id": "rivers", "name": "HydroSHEDS rivers", "type": "line", "color": "#0ea5e9", "widthProp": "width",
               "data": {"type": "FeatureCollection", "features": feats}}
        rows = [[f"Order {o}", round(v[0], 2), v[1], round(v[2], 2)] for o, v in sorted(by_order.items())]
    merit_len = streams.multiply(ee.Image.pixelArea().sqrt()).reduceRegion(ee.Reducer.sum(), roi, 90, maxPixels=1e10, bestEffort=True).get("upa").getInfo() or 0
    merit_km = merit_len / 1000
    return _ok(
        title="Drainage network",
        layers=[{"layerId": "streams", "name": f"Streams (≥ {thr:g} km² upstream)", "visual_url": url, "opacity": 0.9}],
        vectors=[vec] if vec else [],
        legend={"type": "classes", "items": [{"value": 1, "label": f"MERIT streams ≥ {thr:g} km²", "color": "#1d4ed8"},
                                             {"value": 2, "label": "HydroSHEDS rivers (width ∝ order)", "color": "#0ea5e9"}]},
        stats=[{"label": "Stream length (MERIT, threshold)", "value": round(merit_km, 1), "unit": "km"},
               {"label": "Drainage density", "value": round(merit_km / area, 2), "unit": "km/km²"},
               {"label": "HydroSHEDS river length", "value": round(total_len, 1), "unit": f"km ({n} reaches)"},
               {"label": "Max mean discharge", "value": round(max((v[2] for v in by_order.values()), default=0), 1), "unit": "m³/s (long-term avg)"}],
        table={"title": "Rivers by order (HydroSHEDS)", "columns": ["Order", "Length (km)", "Reaches", "Max mean discharge (m³/s)"], "rows": rows} if rows else None,
        chart={"title": "River length by order (km)", "type": "bar", "xKey": "label", "yKey": "value", "unit": "km",
               "data": [{"label": r[0], "value": r[1]} for r in rows]} if rows else None,
        notes=["Streams: MERIT Hydro 90 m upstream-area grid; lower the threshold for finer gullies (0.1–0.5 km²).",
               "Rivers: WWF HydroSHEDS Free-Flowing Rivers with Strahler-like order (RIV_ORD, 1 = largest) and modelled long-term mean discharge.",
               "Drainage density > 2 km/km² indicates highly dissected terrain with fast runoff."],
    )


def hydro_corridor(data):
    roi, area = _roi(data, 3000)
    buf = _num(data, "corridor_m", 250, 50, 2000)
    gsw = ee.Image("JRC/GSW1_4/GlobalSurfaceWater")
    trans = gsw.select("transition").unmask(0)
    extent = gsw.select("max_extent").unmask(0)
    erosion = trans.eq(2).Or(trans.eq(5)).Or(trans.eq(7))        # new permanent / new seasonal / seasonal->permanent
    accretion = trans.eq(3).Or(trans.eq(6))                        # lost permanent / lost seasonal
    stable = trans.eq(1).Or(trans.eq(4)).Or(trans.eq(8))
    corridor = _dist_to(extent, buf * 2).lte(buf)
    cls = (ee.Image(0).where(corridor, 1).where(stable, 2).where(accretion, 3).where(erosion, 4)).selfMask().clip(roi)
    classes = [(1, f"Corridor buffer ({int(buf)} m)", "#fde68a"), (2, "Stable water", "#60a5fa"),
               (3, "Land gained (water lost)", "#a3e635"), (4, "New water (bank erosion / shift)", "#dc2626")]
    layer, legend = _class_layer(cls, classes, roi, 30, "corridor", "River corridor change", 0.85)
    built = ee.Image("JRC/GHSL/P2023A/GHS_BUILT_S/2020").select("built_surface")
    in_corr = corridor.And(extent.Not())
    payload = {
        "areas": _class_areas_expr(cls, roi, 30),
        "pop": _worldpop().multiply(in_corr).reduceRegion(ee.Reducer.sum(), roi, 92.77, maxPixels=1e10, bestEffort=True).get("population"),
        "built": built.multiply(in_corr).reduceRegion(ee.Reducer.sum(), roi, 100, maxPixels=1e10, bestEffort=True).get("built_surface"),
        "crop": ee.Image.pixelArea().divide(1e6).updateMask(in_corr.And(_worldcover().eq(40))).reduceRegion(ee.Reducer.sum(), roi, 30, maxPixels=1e10, bestEffort=True).get("area"),
    }
    if area <= 200:
        bld = ee.FeatureCollection("GOOGLE/Research/open-buildings/v3/polygons").filterBounds(roi).filter(ee.Filter.gte("confidence", 0.7))
        payload["buildings"] = in_corr.reduceRegions(bld.map(lambda f: f.centroid(1)), ee.Reducer.first(), 30).filter(ee.Filter.eq("first", 1)).size()
    r = ee.Dictionary(payload).getInfo()
    rows = _rows_from_groups(r["areas"], classes)
    stats = [{"label": "Bank erosion / new water since 1984", "value": rows[3]["area_km2"], "unit": "km²"},
             {"label": "Land gained", "value": rows[2]["area_km2"], "unit": "km²"},
             {"label": "People within corridor", "value": f"{int(r.get('pop') or 0):,}", "unit": "(WorldPop est.)"},
             {"label": "Built-up within corridor", "value": round((r.get("built") or 0) / 1e6, 3), "unit": "km²"},
             {"label": "Cropland within corridor", "value": round(r.get("crop") or 0, 3), "unit": "km²"}]
    if "buildings" in r:
        stats.append({"label": "Buildings within corridor", "value": f"{r['buildings']:,}", "unit": "(Open Buildings)"})
    return _ok(
        title="River corridor risk (channel migration & exposure)",
        layers=[layer], legend=legend, stats=stats,
        table={"title": "Corridor classes", "columns": ["Class", "Area (km²)", "Share (%)"], "rows": [[x["label"], x["area_km2"], x["percent"]] for x in rows]},
        chart={"title": "Corridor change (km²)", "type": "bar", "xKey": "label", "yKey": "area_km2", "unit": "km²", "data": rows},
        notes=["Channel change from JRC Global Surface Water transitions (1984–1999 vs 2000–2021). Red = land that became water: active bank erosion or channel shift.",
               f"Corridor = maximum water extent plus {int(buf)} m. Settlements inside it need river training, embankments or relocation planning; "
               "check Nepal's river-bank setback rules for your municipality."],
    )


TOOLS = {
    "urban-lulc": urban_lulc,
    "urban-growth": urban_growth,
    "urban-roads": urban_roads,
    "urban-suitability": urban_suitability,
    "disaster-flood": disaster_flood,
    "disaster-landslide": disaster_landslide,
    "disaster-wildfire": disaster_wildfire,
    "disaster-earthquake": disaster_earthquake,
    "disaster-multi": disaster_multi,
    "disaster-impact": disaster_impact,
    "agri-crop": agri_crop,
    "agri-soil": agri_soil,
    "agri-irrigation": agri_irrigation,
    "agri-risk": agri_risk,
    "hydro-drainage": hydro_drainage,
    "hydro-corridor": hydro_corridor,
}
