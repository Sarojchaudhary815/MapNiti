import base64

from app.services import billing as B

GEE_TIF = "https://earthengine.googleapis.com/v1/projects/p/thumbnails/abc123:getPixels"
GEE_JSON = "https://earthengine.googleapis.com/v1/projects/p/tables/xyz:getFeatures"
GEE_TILES = "https://earthengine.googleapis.com/v1/projects/p/maps/m1/tiles/{z}/{x}/{y}"
PNG = "data:image/png;base64," + base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"0" * 64).decode()


def _email(client, auth):
    return client.get("/api/auth/me", headers=auth).json().get("email")


def test_plans_are_public(client):
    d = client.get("/api/billing/plans").json()
    assert {p["id"] for p in d["packs"]} >= {"starter", "monthly"} and d["prices"]["raster"] == 2
    assert d["payment"]["wallet_number"]


def test_welcome_credits_charge_redownload_and_402(client, auth):
    me = client.get("/api/billing/me", headers=auth).json()
    assert me["balance"] == B.WELCOME_CREDITS

    q = client.post("/api/billing/export", json={"kind": "table", "ref": "run1", "dry_run": True}, headers=auth).json()
    assert q["due"] == 1 and q["enough"]
    r = client.post("/api/billing/export", json={"kind": "table", "ref": "run1", "label": "Results CSV"}, headers=auth).json()
    assert r["charged"] == 1 and r["balance"] == B.WELCOME_CREDITS - 1
    # the same file again within 24 h is free
    r = client.post("/api/billing/export", json={"kind": "table", "ref": "run1"}, headers=auth).json()
    assert r["charged"] == 0 and r["balance"] == B.WELCOME_CREDITS - 1

    for i in range(2):   # 4 -> 0
        client.post("/api/billing/export", json={"kind": "raster", "ref": f"tif{i}"}, headers=auth)
    res = client.post("/api/billing/export", json={"kind": "report", "ref": "pdf"}, headers=auth)
    assert res.status_code == 402 and res.json()["detail"]["code"] == "insufficient_credits"
    assert client.post("/api/billing/export", json={"kind": "nope"}, headers=auth).status_code == 400


def test_paid_link_middleware_and_unlock(client, auth):
    import main
    from fastapi import APIRouter
    r = APIRouter()

    @r.get("/api/test-gee-result")
    def fake_result():
        return {"layers": [{"name": "NDVI", "visual_url": GEE_TILES, "download_url": GEE_TIF}],
                "vectors": [{"name": "Basin", "download_url": GEE_JSON}], "other": {"url": "https://example.com/x"}}

    main.app.include_router(r)
    d = client.get("/api/test-gee-result").json()
    layer = d["layers"][0]
    assert layer["visual_url"] == GEE_TILES                      # map tiles untouched
    assert "/download/" in layer["download_url"] and "earthengine" not in layer["download_url"]
    assert d["other"]["url"] == "https://example.com/x"
    token = layer["download_url"].rsplit("/download/", 1)[1]

    q = client.post("/api/billing/export", json={"token": token, "dry_run": True}, headers=auth).json()
    assert q["kind"] == "raster" and q["due"] == 2 and q["label"] == "NDVI"
    res = client.post("/api/billing/export", json={"token": token}, headers=auth).json()
    assert res["url"] == GEE_TIF and res["charged"] == 2
    assert client.post("/api/billing/export", json={"token": token + "x"}, headers=auth).status_code == 400
    assert client.post("/api/billing/export", json={"token": token}).status_code == 401


def test_payment_flow_and_admin(client, auth, admin_auth):
    bad = client.post("/api/billing/payments", json={"pack_id": "gold", "method": "esewa", "txn_id": "ABCD1234"}, headers=auth)
    assert bad.status_code == 400
    p = client.post("/api/billing/payments", json={"pack_id": "starter", "method": "esewa", "txn_id": "TXN-0001",
                                                   "proof_data_url": PNG}, headers=auth).json()["payment"]
    assert p["status"] == "pending" and p["amount_npr"] == 250 and p["has_proof"]
    dup = client.post("/api/billing/payments", json={"pack_id": "starter", "method": "esewa", "txn_id": "TXN-0001"}, headers=auth)
    assert dup.status_code == 400

    # users can't use admin routes
    assert client.post(f"/api/billing/admin/payments/{p['id']}/approve", json={}, headers=auth).status_code == 403
    lst = client.get("/api/billing/admin/payments", headers=admin_auth).json()
    assert any(x["id"] == p["id"] for x in lst["payments"]) and lst["pending"] >= 1
    assert client.get(f"/api/billing/admin/payments/{p['id']}/proof", headers=admin_auth).status_code == 200

    before = client.get("/api/billing/me", headers=auth).json()["balance"]
    client.post(f"/api/billing/admin/payments/{p['id']}/approve", json={}, headers=admin_auth)
    assert client.get("/api/billing/me", headers=auth).json()["balance"] == before + 10
    again = client.post(f"/api/billing/admin/payments/{p['id']}/approve", json={}, headers=admin_auth)
    assert again.status_code == 400                                # never credited twice

    m = client.post("/api/billing/payments", json={"pack_id": "monthly", "method": "khalti", "txn_id": "K-77"}, headers=auth).json()["payment"]
    client.post(f"/api/billing/admin/payments/{m['id']}/reject", json={"note": "not received"}, headers=admin_auth)
    me = client.get("/api/billing/me", headers=auth).json()
    assert not me["unlimited"] and me["payments"][0]["status"] == "rejected"


def test_monthly_plan_and_grant(client, auth, admin_auth):
    email = _email(client, auth)
    g = client.post("/api/billing/admin/grant", json={"email": email, "credits": 0, "days": 30}, headers=admin_auth)
    assert g.status_code == 200 and g.json()["unlimited_until"]
    for i in range(10):
        r = client.post("/api/billing/export", json={"kind": "raster", "ref": f"u{i}"}, headers=auth).json()
        assert r["charged"] == 0
    assert client.post("/api/billing/admin/grant", json={"email": "nobody@example.com", "credits": 5}, headers=admin_auth).status_code == 404


def test_settings_qr(client, admin_auth, auth):
    s = client.put("/api/billing/admin/settings", json={"wallet_number": "98XXXXXXXX", "qr_data_url": PNG}, headers=admin_auth).json()
    assert s["wallet_number"] == "98XXXXXXXX" and s["qr_url"].endswith(".png")
    assert client.put("/api/billing/admin/settings", json={"wallet_number": "1"}, headers=auth).status_code == 403
    plans = client.get("/api/billing/plans").json()
    assert plans["payment"]["qr_url"] == s["qr_url"]
    client.put("/api/billing/admin/settings", json={"remove_qr": True, "wallet_number": "9824646029"}, headers=admin_auth)
