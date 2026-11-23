import uuid

from app.services.analysis_jobs import cache_key

SQUARE = {"type": "Polygon", "coordinates": [[[85.3, 27.7], [85.31, 27.7], [85.31, 27.71], [85.3, 27.71], [85.3, 27.7]]]}


# ---------- basics ----------

def test_root_ok(client):
    assert client.get("/").status_code == 200


def test_private_routes_need_login(client):
    for path in ("/api/field/surveys", "/api/analysis/history", "/api/articles/mine"):
        assert client.get(path).status_code == 401, path


# ---------- analysis cache key ----------

def test_cache_key_ignores_non_inputs():
    a = cache_key("lulc", {"geometry": SQUARE, "year": 2024})
    assert a == cache_key("lulc", {"geometry": SQUARE, "year": 2024, "refresh": True, "aoi_name": "x", "project_id": 9})
    assert a == cache_key("lulc", {"geometry": {"type": "Feature", "geometry": SQUARE}, "year": 2024})


def test_cache_key_changes_with_inputs():
    a = cache_key("lulc", {"geometry": SQUARE, "year": 2024})
    assert a != cache_key("lulc", {"geometry": SQUARE, "year": 2020})
    assert a != cache_key("ndvi", {"geometry": SQUARE, "year": 2024})


# ---------- field data collection ----------

def _record(**kw):
    rec = {"client_id": uuid.uuid4().hex, "lat": 27.7, "lng": 85.32, "accuracy_m": 5.0,
           "data": {"category": "Drain", "condition": "Poor"}, "recorded_at": "2026-11-23T08:00:00Z"}
    rec.update(kw)
    return rec


def test_field_survey_sync_and_export(client, auth, other_auth):
    s = client.post("/api/field/surveys", json={"name": "Ward 5 drains"}, headers=auth).json()["survey"]
    assert [f["key"] for f in s["fields"]] == ["category", "condition", "notes"]

    r1, r2 = _record(), _record(data={"notes": "blocked", "not_a_field": "dropped"})
    res = client.post(f"/api/field/surveys/{s['id']}/sync", json={"records": [r1, r2]}, headers=auth).json()
    assert sorted(res["saved"]) == sorted([r1["client_id"], r2["client_id"]])

    # resending after a dropped connection must not duplicate anything
    res = client.post(f"/api/field/surveys/{s['id']}/sync", json={"records": [r1]}, headers=auth).json()
    assert res["saved"] == [] and res["skipped"] == [r1["client_id"]]

    gj = client.get(f"/api/field/surveys/{s['id']}/records", headers=auth).json()["geojson"]
    assert len(gj["features"]) == 2
    props = [f["properties"] for f in gj["features"]]
    assert all("not_a_field" not in p for p in props)

    csv = client.get(f"/api/field/surveys/{s['id']}/export.csv", headers=auth)
    assert csv.status_code == 200 and "attachment" in csv.headers["content-disposition"]
    lines = csv.text.lstrip("﻿").strip().splitlines()
    assert lines[0].startswith("id,latitude,longitude") and len(lines) == 3

    # someone else cannot see or write to it
    assert client.get(f"/api/field/surveys/{s['id']}/records", headers=other_auth).status_code == 404
    assert client.post(f"/api/field/surveys/{s['id']}/sync", json={"records": [_record()]}, headers=other_auth).status_code == 404


def test_field_bad_photo_keeps_the_point(client, auth):
    s = client.post("/api/field/surveys", json={"name": "Photos"}, headers=auth).json()["survey"]
    r = _record(photo_data_url="data:image/png;base64,AAAA")
    res = client.post(f"/api/field/surveys/{s['id']}/sync", json={"records": [r]}, headers=auth).json()
    assert res["saved"] == [r["client_id"]] and len(res["photo_errors"]) == 1


def test_field_custom_fields_are_cleaned(client, auth):
    s = client.post("/api/field/surveys", json={"name": "Custom", "fields": [
        {"key": "Pipe Size (mm)", "label": "Pipe size", "type": "number"},
        {"key": "pipe size mm", "label": "dup", "type": "number"},
        {"key": "x", "label": "bad type", "type": "script"},
    ]}, headers=auth).json()["survey"]
    assert [f["key"] for f in s["fields"]] == ["pipe_size_mm"]


# ---------- articles ----------

def test_article_publish_share_and_delete(client, auth, other_auth):
    body = {"title": 'Flood risk <script>alert(1)</script> in Bharatpur', "location": "Chitwan",
            "findings": "Most of ward 5 is low lying.", "tool_label": "Flood risk",
            "result": {"title": "Flood", "stats": [{"label": "Area", "value": "12 km²"}], "secret": "dropped"}}
    a = client.post("/api/articles", json=body, headers=auth).json()["article"]
    slug = a["slug"]

    assert any(x["slug"] == slug for x in client.get("/api/articles").json()["articles"])
    full = client.get(f"/api/articles/{slug}").json()
    assert "secret" not in full["result"]

    page = client.get(f"/share/articles/{slug}")
    assert page.status_code == 200
    assert "<script>alert(1)</script>" not in page.text and "og:title" in page.text

    assert client.delete(f"/api/articles/{slug}", headers=other_auth).status_code in (403, 404)
    assert client.delete(f"/api/articles/{slug}", headers=auth).status_code == 200
    assert client.get(f"/api/articles/{slug}").status_code == 404
