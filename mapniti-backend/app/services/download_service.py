"""
Data Download Centre
====================
Everything an engineer needs to take away for an AOI:

  * rasters      — any GEE Data Hub dataset as GeoTIFF in WGS84, the AOI's UTM
                   zone or a custom EPSG, at a chosen resolution
  * contours     — from SRTM / Copernicus / ALOS DEM at a chosen interval,
                   as GeoJSON (WGS84), DXF (UTM, 3D polylines for AutoCAD /
                   Civil 3D) or KML
  * OSM vectors  — roads, buildings, waterways, land use, amenities,
                   railways, power lines (GeoJSON)
  * GEE vectors  — Google Open Buildings footprints and HydroSHEDS rivers
  * boundaries   — Nepal province / district / local-level boundaries (geoBoundaries)
"""
import io
import json
import logging
import math
import os
import urllib.request

import contourpy
import ee
import ezdxf
import numpy as np
from pyproj import Transformer
from shapely.geometry import shape, mapping, LineString

from app.services.hydrology_engine import init_earth_engine, get_roi
from app.services.gee_catalog import CATALOG, _default_dates
from app.services.analysis_engine import overpass, osm_to_geojson, AnalysisError

logger = logging.getLogger("mapniti.download")


def _aoi(data, max_km2):
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        raise AnalysisError("Draw or upload an Area of Interest first.")
    area = roi.area(maxError=10).divide(1e6).getInfo()
    if area > max_km2:
        raise AnalysisError(f"AOI is {area:,.0f} km² — this download supports up to {max_km2:,} km².")
    return roi, area


def _utm_epsg(roi):
    lng, lat = roi.centroid(maxError=10).coordinates().getInfo()
    return (32600 if lat >= 0 else 32700) + int((lng + 180) // 6) + 1


def _resolve_crs(data, roi):
    choice = (data.get("crs") or "EPSG:4326").strip()
    if choice.upper() == "UTM":
        return f"EPSG:{_utm_epsg(roi)}"
    if choice.isdigit():
        return f"EPSG:{choice}"
    return choice.upper()


# --------------------------------------------------------------------------
# Rasters
# --------------------------------------------------------------------------

def raster_links(data):
    """GeoTIFF links for several catalog datasets in one go."""
    roi, area = _aoi(data, 20000)
    crs = _resolve_crs(data, roi)
    ids = data.get("datasets") or []
    if not ids:
        raise AnalysisError("Select at least one dataset.")
    out = []
    for key in ids[:15]:
        d = CATALOG.get(key)
        if not d:
            continue
        start, end = _default_dates(key)
        start = data.get("start_date") or start
        end = data.get("end_date") or end
        scale = float(data.get("scale") or d["resolution"])
        scale = max(scale, d["resolution"] if d["resolution"] < 30 else 10)
        # Direct downloads are capped (~32 MB); estimate pixels and coarsen if needed.
        px = area * 1e6 / (scale * scale)
        bands = 3 if d["kind"] == "rgb" else 1
        max_px = 30_000_000 / (4 * bands)
        note = None
        if px > max_px:
            new_scale = math.ceil(math.sqrt(area * 1e6 / max_px))
            note = f"Resolution coarsened from {scale:g} m to {new_scale} m to fit the 32 MB direct-download limit. Use smaller AOI for full resolution."
            scale = new_scale
        try:
            img = d["build"](start, end).clip(roi)
            img = img.toFloat() if d["kind"] != "categorical" else img.toInt16()
            url = img.getDownloadURL({"region": roi, "scale": scale, "crs": crs, "format": "GEO_TIFF",
                                      "name": f"mapniti_{key}"})
            out.append({"id": key, "name": d["name"], "url": url, "crs": crs, "scale_m": scale,
                        "units": d["units"], "note": note, "filename": f"mapniti_{key}.tif"})
        except Exception as exc:  # noqa: BLE001 — keep the other datasets
            out.append({"id": key, "name": d["name"], "error": str(exc)[:200]})
    return {"status": "success", "crs": crs, "files": out}


# --------------------------------------------------------------------------
# Contours
# --------------------------------------------------------------------------

DEMS = {
    "SRTM": lambda: ee.Image("USGS/SRTMGL1_003").select("elevation"),
    "COPERNICUS": lambda: ee.ImageCollection("COPERNICUS/DEM/GLO30_2024_1").select("DEM").mosaic(),
    "ALOS": lambda: ee.ImageCollection("JAXA/ALOS/AW3D30/V4_1").select("DSM").mosaic(),
}


def contours(data):
    roi, area = _aoi(data, 400)
    interval = float(data.get("interval") or 10)
    if interval < 1:
        raise AnalysisError("Contour interval must be at least 1 m.")
    fmt = (data.get("format") or "geojson").lower()
    dem_key = data.get("dem", "SRTM").upper()
    epsg = _utm_epsg(roi)
    scale = 30 if area <= 150 else 60 if area <= 400 else 90

    # Sample the DEM on a regular UTM grid (sampleRectangle ≤ 262,144 px).
    bounds = roi.transform(f"EPSG:{epsg}", 1).bounds(1, f"EPSG:{epsg}").coordinates().getInfo()[0]
    xs = [p[0] for p in bounds]
    ys = [p[1] for p in bounds]
    bx0, bx1, by0, by1 = min(xs), max(xs), min(ys), max(ys)
    while ((bx1 - bx0) / scale) * ((by1 - by0) / scale) > 250_000:
        scale *= 1.5
    # Snap the window to the projection's pixel grid (origin 0,0 at `scale`)
    # so array cell (r, c) is exactly the DEM pixel we place it at.
    x0, x1 = math.floor(bx0 / scale) * scale, math.ceil(bx1 / scale) * scale
    y0, y1 = math.floor(by0 / scale) * scale, math.ceil(by1 / scale) * scale
    dem = DEMS.get(dem_key, DEMS["SRTM"])().rename("z")
    proj = ee.Projection(f"EPSG:{epsg}").atScale(scale)
    rect = ee.Geometry.Rectangle([x0, y0, x1, y1], f"EPSG:{epsg}", False)
    arr = dem.reproject(proj).sampleRectangle(region=rect, defaultValue=-9999).get("z").getInfo()
    z = np.array(arr, dtype=float)
    z[z <= -9990] = np.nan
    if np.all(np.isnan(z)):
        raise AnalysisError("DEM returned no data for this area.")
    rows, cols = z.shape
    # Values are pixel centres. In a projected CRS sampleRectangle returns row 0
    # at the SOUTH edge (verified with ee.Image.pixelCoordinates), so y grows with row.
    gx = x0 + (np.arange(cols) + 0.5) * scale
    gy = y0 + (np.arange(rows) + 0.5) * scale

    zmin, zmax = np.nanmin(z), np.nanmax(z)
    levels = np.arange(math.ceil(zmin / interval) * interval, zmax + 1e-6, interval)
    if len(levels) > 600:
        raise AnalysisError(f"That interval gives {len(levels)} contour levels — use a larger interval.")
    gen = contourpy.contour_generator(gx, gy, z, name="serial", line_type="Separate")

    aoi_utm = shape(roi.transform(f"EPSG:{epsg}", 1).getInfo())
    to_wgs = Transformer.from_crs(f"EPSG:{epsg}", "EPSG:4326", always_xy=True)
    major_every = int(data.get("major_every") or 5)
    lines_utm = []
    for i, lev in enumerate(levels):
        for seg in gen.lines(lev):
            if len(seg) < 2:
                continue
            ln = LineString(seg).intersection(aoi_utm)
            if ln.is_empty:
                continue
            parts = [ln] if ln.geom_type == "LineString" else [g for g in getattr(ln, "geoms", []) if g.geom_type == "LineString"]
            major = (round(lev / interval) % major_every) == 0
            for part in parts:
                if len(part.coords) >= 2:
                    lines_utm.append((float(lev), major, list(part.coords)))

    summary = {"levels": len(levels), "lines": len(lines_utm), "min_elev": round(float(zmin), 1),
               "max_elev": round(float(zmax), 1), "interval_m": interval, "grid_m": round(scale, 1),
               "utm_epsg": epsg, "dem": dem_key}

    if fmt == "dxf":
        doc = ezdxf.new("R2010")
        doc.layers.add("CONTOUR_MINOR", color=8)
        doc.layers.add("CONTOUR_MAJOR", color=1)
        msp = doc.modelspace()
        for lev, major, coords in lines_utm:
            msp.add_polyline3d([(x, y, lev) for x, y in coords],
                               dxfattribs={"layer": "CONTOUR_MAJOR" if major else "CONTOUR_MINOR"})
        buf = io.StringIO()
        doc.write(buf)
        return {"status": "success", "summary": summary, "format": "dxf",
                "filename": f"contours_{int(interval)}m_utm{epsg}.dxf", "content": buf.getvalue()}

    feats = []
    for lev, major, coords in lines_utm:
        lon, lat = to_wgs.transform([c[0] for c in coords], [c[1] for c in coords])
        feats.append({"type": "Feature", "properties": {"elevation": lev, "type": "major" if major else "minor"},
                      "geometry": {"type": "LineString", "coordinates": [[round(a, 7), round(b, 7)] for a, b in zip(lon, lat)]}})
    return {"status": "success", "summary": summary, "format": "geojson",
            "filename": f"contours_{int(interval)}m.geojson",
            "geojson": {"type": "FeatureCollection", "features": feats}}


# --------------------------------------------------------------------------
# Vectors
# --------------------------------------------------------------------------

OSM_LAYERS = {
    "roads": ('way["highway"]', "Roads & paths"),
    "buildings": ('way["building"]', "Buildings"),
    "waterways": ('way["waterway"]', "Rivers, streams & canals"),
    "water": ('way["natural"="water"]', "Lakes & ponds"),
    "landuse": ('way["landuse"]', "Land use"),
    "amenities": ('node["amenity"]', "Amenities (schools, health, banks…)"),
    "railways": ('way["railway"]', "Railways"),
    "power": ('way["power"="line"]', "Power lines"),
    "bridges": ('way["bridge"="yes"]', "Bridges"),
}


def osm_layer(data):
    layer = data.get("layer")
    if layer not in OSM_LAYERS:
        raise AnalysisError("Unknown OSM layer.")
    g = data.get("geometry")
    if not g:
        raise AnalysisError("Draw or upload an Area of Interest first.")
    if g.get("type") == "FeatureCollection":
        g = g["features"][0]["geometry"]
    elif g.get("type") == "Feature":
        g = g["geometry"]
    aoi = shape(g)
    w, s, e, n = aoi.bounds
    from pyproj import Geod
    area = abs(Geod(ellps="WGS84").geometry_area_perimeter(aoi)[0]) / 1e6
    limit = 150 if layer == "buildings" else 600
    if area > limit:
        raise AnalysisError(f"AOI is {area:,.0f} km² — OSM {layer} download supports up to {limit} km².")
    sel, label = OSM_LAYERS[layer]
    q = f"[out:json][timeout:60];{sel}({s},{w},{n},{e});out geom;"
    try:
        gj = osm_to_geojson(overpass(q, timeout=70))
    except Exception as exc:  # noqa: BLE001
        raise AnalysisError(f"OpenStreetMap servers are busy ({exc}). Please try again in a minute.")
    kept = []
    for f in gj["features"]:
        geom = shape(f["geometry"])
        if geom.intersects(aoi):
            if f["geometry"]["type"] != "Point":
                clipped = geom.intersection(aoi) if layer not in ("buildings",) else geom
                if clipped.is_empty:
                    continue
                f["geometry"] = mapping(clipped)
            kept.append(f)
    return {"status": "success", "layer": layer, "name": label, "count": len(kept),
            "filename": f"osm_{layer}.geojson", "geojson": {"type": "FeatureCollection", "features": kept}}


def gee_vector(data):
    kind = data.get("kind")
    roi, area = _aoi(data, 300 if kind == "buildings" else 20000)
    if kind == "buildings":
        fc = (ee.FeatureCollection("GOOGLE/Research/open-buildings/v3/polygons").filterBounds(roi)
              .filter(ee.Filter.gte("confidence", float(data.get("min_confidence", 0.7))))
              .select(["confidence", "area_in_meters", "full_plus_code"]))
        name = "open_buildings"
    elif kind == "rivers":
        fc = (ee.FeatureCollection("WWF/HydroSHEDS/v1/FreeFlowingRivers").filterBounds(roi)
              .select(["RIV_ORD", "UPLAND_SKM", "DIS_AV_CMS", "LENGTH_KM", "BB_NAME"]))
        name = "hydrosheds_rivers"
    elif kind == "basins":
        fc = ee.FeatureCollection("WWF/HydroSHEDS/v1/Basins/hybas_8").filterBounds(roi).select(["HYBAS_ID", "SUB_AREA", "UP_AREA"])
        name = "hydrobasins_l8"
    else:
        raise AnalysisError("Unknown dataset.")
    count = fc.size().getInfo()
    if count == 0:
        raise AnalysisError("No features in this AOI.")
    fmt = (data.get("format") or "geojson").lower()
    filetype = {"geojson": "GEOJSON", "kml": "KML", "shp": "SHP", "csv": "CSV"}.get(fmt, "GEOJSON")
    url = fc.getDownloadURL(filetype=filetype, filename=name)
    return {"status": "success", "count": count, "url": url, "filename": f"{name}.{fmt if fmt != 'shp' else 'zip'}"}


# --------------------------------------------------------------------------
# Nepal administrative boundaries (geoBoundaries, CC BY 4.0)
# --------------------------------------------------------------------------

_BOUNDARY_CACHE = {}
_BOUNDARY_GEOJSON_CACHE = {}


def boundary_geojson(country="NPL", level="ADM2"):
    """Simplified boundary FeatureCollection, proxied + cached server-side.

    geoBoundaries serves files via GitHub redirects that browsers block
    (no CORS headers), so the AOI picker loads them through the API instead.
    Only the name property is kept to keep the payload small.
    """
    key = (country, level)
    if key in _BOUNDARY_GEOJSON_CACHE:
        return _BOUNDARY_GEOJSON_CACHE[key]
    cache_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "static", "boundaries")
    cache_file = os.path.join(cache_dir, f"{country}_{level}.geojson")
    if os.path.exists(cache_file):
        with open(cache_file, encoding="utf-8") as fh:
            _BOUNDARY_GEOJSON_CACHE[key] = json.load(fh)
        return _BOUNDARY_GEOJSON_CACHE[key]
    meta = boundaries(country)
    entry = next((l for l in meta["levels"] if l["level"] == level), None)
    if not entry:
        raise AnalysisError(f"No {level} boundaries for {country}.")
    url = entry["simplified"] or entry["geojson"]
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "MapNiti/1.0"}), timeout=90) as r:
        gj = json.loads(r.read().decode())
    feats = [{"type": "Feature", "properties": {"shapeName": f["properties"].get("shapeName")}, "geometry": f["geometry"]}
             for f in gj.get("features", []) if f.get("geometry")]
    res = {"type": "FeatureCollection", "features": feats}
    os.makedirs(cache_dir, exist_ok=True)
    with open(cache_file, "w", encoding="utf-8") as fh:
        json.dump(res, fh)
    _BOUNDARY_GEOJSON_CACHE[key] = res
    return res


def boundaries(country="NPL"):
    if country in _BOUNDARY_CACHE:
        return _BOUNDARY_CACHE[country]
    url = f"https://www.geoboundaries.org/api/current/gbOpen/{country}/ALL/"
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "MapNiti/1.0"}), timeout=30) as r:
        meta = json.loads(r.read().decode())
    labels = {"ADM0": "Country", "ADM1": "Provinces", "ADM2": "Districts", "ADM3": "Local levels (palika)", "ADM4": "Wards"}
    out = [{"level": m["boundaryType"], "label": labels.get(m["boundaryType"], m["boundaryType"]),
            "year": m.get("boundaryYearRepresented"), "source": m.get("boundarySource"),
            "license": m.get("boundaryLicense"), "count": m.get("admUnitCount"),
            "geojson": m.get("gjDownloadURL"), "simplified": m.get("simplifiedGeometryGeoJSON"),
            "zip": m.get("staticDownloadLink")}
           for m in meta]
    res = {"status": "success", "country": country, "levels": sorted(out, key=lambda x: x["level"])}
    _BOUNDARY_CACHE[country] = res
    return res
