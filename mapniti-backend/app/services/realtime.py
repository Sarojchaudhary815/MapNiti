"""Live Nepal feeds from the BIPAD portal (Government of Nepal, NDRRMA).

* River levels   — DHM hydrological stations, newest reading per station
* Rainfall       — DHM rain gauges, 1/3/6/12/24 h totals per station
* Incidents      — reported disaster incidents with hazard type and losses

Answers are cached in memory for a few minutes; the public API is fast but the
stations only report every 5–15 minutes anyway. Each feed is returned as a
GeoJSON FeatureCollection ready for the map, plus a short summary.
"""
import json
import logging
import threading
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

from app.services.analysis_engine import AnalysisError

logger = logging.getLogger(__name__)

BASE = "https://bipadportal.gov.np/api/v1"
NPT = timezone(timedelta(hours=5, minutes=45))
SOURCE = "BIPAD Portal (NDRRMA) · Department of Hydrology and Meteorology"
_cache = {}
_lock = threading.Lock()

STATUS_COLOR = {"BELOW WARNING LEVEL": "#16a34a", "ABOVE WARNING LEVEL": "#f59e0b", "ABOVE DANGER LEVEL": "#dc2626"}


def _get(path, params, timeout=45):
    url = f"{BASE}/{path}/?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": "MapNiti/1.0 (GIS platform)", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        logger.warning("BIPAD %s failed: %s", path, exc)
        raise AnalysisError("The BIPAD portal did not answer. Try again in a minute.") from exc


def _cached(key, ttl, fn):
    with _lock:
        hit = _cache.get(key)
        if hit and time.time() - hit[0] < ttl:
            return hit[1]
    value = fn()
    with _lock:
        _cache[key] = (time.time(), value)
    return value


def _since(hours):
    return (datetime.now(NPT) - timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M")


def _latest_per_station(rows, time_key):
    best = {}
    for r in rows:
        sid = r.get("stationSeriesId") or r.get("title")
        if sid not in best or (r.get(time_key) or "") > (best[sid].get(time_key) or ""):
            best[sid] = r
    return list(best.values())


def rivers():
    def load():
        d = _get("river", {"format": "json", "limit": 3000, "water_level_on__gt": _since(6), "ordering": "-water_level_on",
                           "fields": "title,basin,point,water_level,water_level_on,danger_level,warning_level,status,steady,station_series_id"})
        feats = []
        for r in _latest_per_station(d.get("results", []), "waterLevelOn"):
            if not r.get("point"):
                continue
            status = r.get("status") or "BELOW WARNING LEVEL"
            feats.append({"type": "Feature", "geometry": r["point"], "properties": {
                "name": r.get("title"), "basin": r.get("basin"),
                "water_level_m": round(r["waterLevel"], 2) if r.get("waterLevel") is not None else None,
                "warning_level_m": r.get("warningLevel"), "danger_level_m": r.get("dangerLevel"),
                "status": status.title(), "trend": (r.get("steady") or "").title(), "time": r.get("waterLevelOn"),
                "color": STATUS_COLOR.get(status, "#64748b"),
                "radius": 9 if "DANGER" in status else 7 if "WARNING" in status and "BELOW" not in status else 5,
            }})
        alerts = sorted([f["properties"] for f in feats if "Below" not in f["properties"]["status"]],
                        key=lambda p: "Danger" not in p["status"])
        return {"status": "success", "kind": "rivers", "source": SOURCE, "updated": datetime.now(NPT).isoformat(),
                "summary": {"stations": len(feats), "warning": sum("Warning" in a["status"] for a in alerts),
                            "danger": sum("Danger" in a["status"] for a in alerts)},
                "alerts": alerts[:50], "geojson": {"type": "FeatureCollection", "features": feats}}
    return _cached("rivers", 300, load)


def _rain_color(mm):
    if mm is None:
        return "#94a3b8"
    for limit, color in ((0.1, "#cbd5e1"), (10, "#7dd3fc"), (25, "#38bdf8"), (50, "#2563eb"), (100, "#7c3aed")):
        if mm < limit:
            return color
    return "#dc2626"


def rainfall():
    def load():
        d = _get("rain", {"format": "json", "limit": 3000, "measured_on__gt": _since(3), "ordering": "-measured_on",
                          "fields": "title,basin,point,averages,status,measured_on,station_series_id"})
        feats = []
        for r in _latest_per_station(d.get("results", []), "measuredOn"):
            if not r.get("point"):
                continue
            avg = {a.get("interval"): a.get("value") for a in r.get("averages") or []}
            mm24 = avg.get(24)
            status = r.get("status") or "BELOW WARNING LEVEL"
            feats.append({"type": "Feature", "geometry": r["point"], "properties": {
                "name": r.get("title"), "basin": r.get("basin"),
                "rain_1h_mm": avg.get(1), "rain_3h_mm": avg.get(3), "rain_6h_mm": avg.get(6),
                "rain_12h_mm": avg.get(12), "rain_24h_mm": mm24, "status": status.title(), "time": r.get("measuredOn"),
                "color": STATUS_COLOR[status] if "BELOW" not in status and status in STATUS_COLOR else _rain_color(mm24),
                "radius": 4 if not mm24 else 5 if mm24 < 25 else 7 if mm24 < 100 else 9,
            }})
        wet = sorted([f["properties"] for f in feats if f["properties"]["rain_24h_mm"]],
                     key=lambda p: -(p["rain_24h_mm"] or 0))
        return {"status": "success", "kind": "rainfall", "source": SOURCE, "updated": datetime.now(NPT).isoformat(),
                "summary": {"stations": len(feats), "raining": len(wet),
                            "max_24h_mm": wet[0]["rain_24h_mm"] if wet else 0,
                            "warning": sum("Below" not in f["properties"]["status"] for f in feats)},
                "alerts": wet[:30], "legend": [["< 0.1 mm", "#cbd5e1"], ["< 10", "#7dd3fc"], ["< 25", "#38bdf8"],
                                                 ["< 50", "#2563eb"], ["< 100", "#7c3aed"], ["≥ 100 mm", "#dc2626"]],
                "geojson": {"type": "FeatureCollection", "features": feats}}
    return _cached("rainfall", 300, load)


def incidents(days=30):
    days = max(1, min(int(days), 365))

    def load():
        since = (datetime.now(NPT) - timedelta(days=days)).strftime("%Y-%m-%d")
        d = _get("incident", {"format": "json", "limit": 5000, "incident_on__gt": since, "ordering": "-incident_on",
                              "expand": "hazard,loss", "fields": "id,title,incident_on,hazard,loss,point,verified,street_address"},
                 timeout=90)
        feats, by_hazard = [], {}
        deaths = injured = missing = 0
        for r in d.get("results", []):
            if not r.get("point"):
                continue
            hz = r.get("hazard") or {}
            loss = r.get("loss") or {}
            dc, ic, mc = loss.get("peopleDeathCount") or 0, loss.get("peopleInjuredCount") or 0, loss.get("peopleMissingCount") or 0
            deaths, injured, missing = deaths + dc, injured + ic, missing + mc
            name = hz.get("titleEn") or hz.get("title") or "Other"
            h = by_hazard.setdefault(name, {"hazard": name, "color": hz.get("color") or "#64748b", "count": 0, "deaths": 0})
            h["count"] += 1
            h["deaths"] += dc
            feats.append({"type": "Feature", "geometry": r["point"], "properties": {
                "name": r.get("title"), "hazard": name, "date": (r.get("incidentOn") or "")[:10],
                "deaths": dc, "injured": ic, "missing": mc, "verified": "yes" if r.get("verified") else "no",
                "bipad_id": r.get("id"), "color": hz.get("color") or "#64748b",
                "radius": 5 if not dc else 7 if dc < 3 else 10,
            }})
        return {"status": "success", "kind": "incidents", "source": "BIPAD Portal (NDRRMA)", "days": days,
                "updated": datetime.now(NPT).isoformat(),
                "summary": {"incidents": len(feats), "deaths": deaths, "injured": injured, "missing": missing},
                "by_hazard": sorted(by_hazard.values(), key=lambda h: -h["count"]),
                "geojson": {"type": "FeatureCollection", "features": feats}}
    return _cached(f"incidents-{days}", 900, load)
