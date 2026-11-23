"""Nepal Province → District → Palika → Ward hierarchy for the AOI picker.

Palikas come from younginnovations/nepal-locallevel-map (MIT; Survey Department
boundaries of the 753 local levels plus national parks/reserves), which carries
each palika's district, province and ward count. Districts and provinces are the
union of their palikas, so all three levels share the same edges (77 districts).

Wards are not in any open national dataset, so they are fetched per palika from
OpenStreetMap (admin_level=9) on demand and cached; coverage depends on OSM.
"""
import json
import logging
import os
import threading
import urllib.request

from shapely.geometry import shape, mapping
from shapely.ops import unary_union, linemerge, polygonize

from app.services.analysis_engine import AnalysisError, overpass

logger = logging.getLogger(__name__)

STATIC = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "static", "boundaries")
WARD_DIR = os.path.join(STATIC, "wards")
LOCAL_FILE = os.path.join(STATIC, "NPL_locallevels.geojson")
LOCAL_URL = ("https://raw.githubusercontent.com/younginnovations/nepal-locallevel-map/master/"
             "out/municipalities.simplified.geojson")
SOURCE = "Survey Department of Nepal via younginnovations/nepal-locallevel-map (MIT)"

PROVINCES = {1: "Koshi", 2: "Madhesh", 3: "Bagmati", 4: "Gandaki", 5: "Lumbini", 6: "Karnali", 7: "Sudurpashchim"}
DISTRICT_NAMES = {
    "Nawalparasi_E": "Nawalparasi East (Nawalpur)", "Nawalparasi_W": "Nawalparasi West (Parasi)",
    "Rukum_E": "Rukum East", "Rukum_W": "Rukum West", "Chitawan": "Chitwan", "Makawanpur": "Makwanpur",
    "Kabhrepalanchok": "Kavrepalanchok", "Terhathum": "Tehrathum",
}
TYPE_LABEL = {"Gaunpalika": "Rural Municipality", "Nagarpalika": "Municipality",
              "Upamahanagarpalika": "Sub-Metropolitan City", "Mahanagarpalika": "Metropolitan City"}

_lock = threading.Lock()
_state = {}


def _load_local_levels():
    if not os.path.exists(LOCAL_FILE):
        os.makedirs(STATIC, exist_ok=True)
        req = urllib.request.Request(LOCAL_URL, headers={"User-Agent": "MapNiti/1.0"})
        with urllib.request.urlopen(req, timeout=90) as r:
            data = r.read()
        json.loads(data)  # refuse to cache a broken download
        with open(LOCAL_FILE, "wb") as fh:
            fh.write(data)
    with open(LOCAL_FILE, encoding="utf-8") as fh:
        return json.load(fh)


def _bbox(geom):
    w, s, e, n = geom.bounds
    return [round(w, 5), round(s, 5), round(e, 5), round(n, 5)]


def _build():
    """Index + shapes for all three levels (built once per process)."""
    with _lock:
        if _state:
            return _state
        palikas = []
        for f in _load_local_levels()["features"]:
            if not f.get("geometry"):
                continue
            pr = f["properties"]
            palikas.append({
                "name": pr.get("locallevel_name"),
                "type": TYPE_LABEL.get(pr.get("locallevel_type"), pr.get("locallevel_type")),
                "wards": int(pr["wards"]) if pr.get("wards") else None,
                "district": DISTRICT_NAMES.get(pr.get("district"), pr.get("district")),
                "province": PROVINCES.get(pr.get("province"), str(pr.get("province"))),
                "geom": shape(f["geometry"]).buffer(0),
            })
        order = list(PROVINCES.values())
        palikas.sort(key=lambda p: (order.index(p["province"]) if p["province"] in order else 99, p["district"], str(p["name"])))

        dgroups, pgroups = {}, {}
        for p in palikas:
            dgroups.setdefault((p["province"], p["district"]), []).append(p["geom"])
            pgroups.setdefault(p["province"], []).append(p["geom"])
        districts = [{"name": d, "province": pv, "geom": unary_union(gs).buffer(0)} for (pv, d), gs in dgroups.items()]
        provinces = [{"name": pv, "geom": unary_union(pgroups[pv]).buffer(0)} for pv in order if pv in pgroups]
        _state.update({"province": provinces, "district": districts, "palika": palikas})
        return _state


def index():
    st = _build()
    return {
        "status": "success",
        "provinces": [{"i": i, "name": p["name"], "bbox": _bbox(p["geom"])} for i, p in enumerate(st["province"])],
        "districts": [{"i": i, "name": d["name"], "province": d["province"], "bbox": _bbox(d["geom"])}
                      for i, d in enumerate(st["district"])],
        "palikas": [{"i": i, "name": p["name"], "type": p["type"], "wards": p["wards"], "district": p["district"],
                     "province": p["province"], "bbox": _bbox(p["geom"])} for i, p in enumerate(st["palika"])],
        "source": SOURCE,
    }


def feature(level: str, i: int):
    st = _build()
    if level not in st:
        raise AnalysisError("Level must be province, district or palika.")
    items = st[level]
    if not 0 <= i < len(items):
        raise AnalysisError("No such boundary.")
    it = items[i]
    props = {"shapeName": it["name"], "level": level}
    for k in ("district", "province", "type", "wards"):
        if k in it:
            props[k] = it[k]
    return {"type": "Feature", "properties": props, "geometry": mapping(it["geom"].simplify(0.0005, preserve_topology=True))}


def _relation_polygon(rel):
    lines = []
    for m in rel.get("members", []):
        if m.get("type") == "way" and m.get("role") in ("outer", "") and m.get("geometry"):
            lines.append([(p["lon"], p["lat"]) for p in m["geometry"]])
    if not lines:
        return None
    polys = list(polygonize(linemerge(lines)))
    if not polys:
        return None
    return unary_union(polys).buffer(0)


def wards(i: int):
    """Ward polygons of one palika from OpenStreetMap, cached on disk."""
    st = _build()
    if not 0 <= i < len(st["palika"]):
        raise AnalysisError("No such palika.")
    pal = st["palika"][i]
    os.makedirs(WARD_DIR, exist_ok=True)
    cache = os.path.join(WARD_DIR, f"NPL_palika_{i}.json")
    if os.path.exists(cache):
        with open(cache, encoding="utf-8") as fh:
            return json.load(fh)

    w, s, e, n = pal["geom"].bounds
    q = (f'[out:json][timeout:80];rel["boundary"="administrative"]["admin_level"="9"]({s},{w},{n},{e});out geom;')
    data = overpass(q, timeout=80)
    pal_geom = pal["geom"]
    feats = []
    for rel in data.get("elements", []):
        if rel.get("type") != "relation":
            continue
        g = _relation_polygon(rel)
        if g is None or g.is_empty:
            continue
        # keep wards that sit inside this palika (their centre in it, mostly overlapping)
        if not pal_geom.contains(g.representative_point()) or g.intersection(pal_geom).area < 0.5 * g.area:
            continue
        tags = rel.get("tags", {})
        label = tags.get("name:en") or tags.get("name") or tags.get("ref") or f"Ward {len(feats) + 1}"
        num = "".join(ch for ch in (tags.get("ref") or label) if ch.isdigit())
        feats.append({"type": "Feature",
                      "properties": {"shapeName": f"{pal['name']} ward {int(num)}" if num else label, "ward": int(num) if num else None,
                                     "osm_id": rel.get("id")},
                      "geometry": mapping(g.simplify(0.0001, preserve_topology=True))})
    feats.sort(key=lambda f: (f["properties"]["ward"] is None, f["properties"]["ward"] or 0, f["properties"]["shapeName"]))
    res = {"status": "success", "palika": pal["name"], "expected": pal["wards"], "type": "FeatureCollection", "features": feats,
           "source": "OpenStreetMap contributors (ODbL), admin_level=9"}
    if feats:  # don't cache an empty answer: OSM may gain the wards later
        with open(cache, "w", encoding="utf-8") as fh:
            json.dump(res, fh)
    return res
