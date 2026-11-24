"""Credits, export pricing and paid download links.

Earth Engine download URLs (GeoTIFF / GeoJSON files) never reach the browser
directly: `ExportLinkMiddleware` rewrites them into `<FRONTEND>/download/<token>`
links. That page asks the user to confirm, the server charges credits, and only
then returns the real URL. Exports the browser builds itself (CSV, PDF report,
GeoJSON of results already on screen) call `charge()` through /api/billing/export.
"""
import base64
import hashlib
import hmac
import json
import time
from datetime import datetime, timedelta
from urllib.parse import urlparse

from fastapi import HTTPException

from app.config import JWT_SECRET_KEY, FRONTEND_URL
from app.models.billing import Wallet, CreditEntry, ExportCharge

WELCOME_CREDITS = 5
REDOWNLOAD_WINDOW = timedelta(hours=24)
LINK_TTL_S = 24 * 3600

# Credits per export
PRICES = {
    "raster": 2,     # GeoTIFF from Earth Engine (DEM, NDVI, land cover, flood maps…)
    "vector": 1,     # GeoJSON / Shapefile / KML of results or OSM / building data
    "table": 1,      # CSV tables, time series, profiles
    "report": 1,     # PDF analysis or site report
    "cad": 2,        # DXF contours
}
KIND_LABELS = {"raster": "GeoTIFF raster", "vector": "Vector data", "table": "CSV table",
               "report": "PDF report", "cad": "DXF drawing"}

# What people can buy (prices in NPR)
PACKS = [
    {"id": "starter", "name": "Starter", "credits": 10, "price": 250, "days": 0,
     "blurb": "A few downloads for one project"},
    {"id": "standard", "name": "Standard", "credits": 40, "price": 800, "days": 0,
     "blurb": "Best value for regular project work", "popular": True},
    {"id": "pro", "name": "Pro", "credits": 120, "price": 2000, "days": 0,
     "blurb": "For firms and heavy users"},
    {"id": "monthly", "name": "Unlimited · 30 days", "credits": 0, "price": 1500, "days": 30,
     "blurb": "Every export free for 30 days"},
]
PACK_BY_ID = {p["id"]: p for p in PACKS}
METHODS = {"esewa": "eSewa", "khalti": "Khalti", "fonepay": "Fonepay / mobile banking QR", "bank": "Bank transfer"}

DEFAULT_SETTINGS = {
    "account_name": "Saroj Chaudhary",
    "wallet_number": "9824646029",
    "instructions": "Scan the QR or send the amount to the number below with eSewa, Khalti or mobile banking, "
                    "then enter the transaction ID here. Credits are added after we check the payment, usually within a few hours.",
    "qr_path": "",
}


# ---------------------------------------------------------------- wallet

def wallet(db, user_id: int, lock: bool = False) -> Wallet:
    q = db.query(Wallet).filter(Wallet.user_id == user_id)
    w = (q.with_for_update() if lock else q).first()
    if not w:
        w = Wallet(user_id=user_id, balance=WELCOME_CREDITS)
        db.add(w)
        db.add(CreditEntry(user_id=user_id, delta=WELCOME_CREDITS, reason="welcome", note="Welcome credits"))
        db.commit()
        w = (q.with_for_update() if lock else q).first()
    return w


def unlimited_active(w: Wallet) -> bool:
    return bool(w.unlimited_until and w.unlimited_until > datetime.utcnow())


def add_credits(db, user_id: int, credits: int, reason: str, note: str = None, days: int = 0):
    w = wallet(db, user_id, lock=True)
    if credits:
        w.balance += credits
        db.add(CreditEntry(user_id=user_id, delta=credits, reason=reason, note=note))
    if days:
        start = w.unlimited_until if unlimited_active(w) else datetime.utcnow()
        w.unlimited_until = start + timedelta(days=days)
        db.add(CreditEntry(user_id=user_id, delta=0, reason="plan", note=note or f"Unlimited exports for {days} days"))
    db.commit()
    return w


def recent_charge(db, user_id: int, ref: str):
    since = datetime.utcnow() - REDOWNLOAD_WINDOW
    return (db.query(ExportCharge)
            .filter(ExportCharge.user_id == user_id, ExportCharge.ref == ref, ExportCharge.created_at >= since)
            .first())


def quote(db, user_id: int, kind: str, ref: str) -> dict:
    w = wallet(db, user_id)
    cost = PRICES.get(kind, 1)
    free_again = recent_charge(db, user_id, ref) is not None
    unlimited = unlimited_active(w)
    due = 0 if (free_again or unlimited) else cost
    return {"kind": kind, "kind_label": KIND_LABELS.get(kind, kind), "cost": cost, "due": due,
            "already_paid": free_again, "unlimited": unlimited, "balance": w.balance,
            "enough": w.balance >= due}


def charge(db, user_id: int, kind: str, ref: str, label: str = None) -> dict:
    """Charge for one export, or nothing if it was paid in the last 24 h or a monthly plan is active.
    Raises 402 when the balance is too low."""
    if kind not in PRICES:
        raise HTTPException(status_code=400, detail="Unknown export type.")
    ref = (ref or "")[:120] or "export"
    w = wallet(db, user_id, lock=True)
    if recent_charge(db, user_id, ref):
        return {"charged": 0, "balance": w.balance, "unlimited": unlimited_active(w)}
    cost = 0 if unlimited_active(w) else PRICES[kind]
    if w.balance < cost:
        db.rollback()
        raise HTTPException(status_code=402, detail={
            "code": "insufficient_credits", "message": "Not enough credits for this export.",
            "needed": cost, "balance": w.balance})
    w.balance -= cost
    db.add(ExportCharge(user_id=user_id, ref=ref, kind=kind, label=(label or "")[:200] or None, credits=cost))
    if cost:
        db.add(CreditEntry(user_id=user_id, delta=-cost, reason="export", note=(label or KIND_LABELS[kind])[:255]))
    db.commit()
    return {"charged": cost, "balance": w.balance, "unlimited": unlimited_active(w)}


# ---------------------------------------------------------------- paid download links

def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _sign(payload: bytes) -> str:
    return _b64(hmac.new(JWT_SECRET_KEY.encode(), payload, hashlib.sha256).digest()[:18])


def make_token(url: str, kind: str, name: str = None) -> str:
    payload = json.dumps({"u": url, "k": kind, "n": (name or "")[:120], "e": int(time.time()) + LINK_TTL_S},
                         separators=(",", ":")).encode()
    return f"{_b64(payload)}.{_sign(payload)}"


def read_token(token: str) -> dict:
    try:
        body, sig = token.split(".", 1)
        payload = _unb64(body)
        if not hmac.compare_digest(sig, _sign(payload)):
            raise ValueError
        data = json.loads(payload)
    except (ValueError, json.JSONDecodeError):
        raise HTTPException(status_code=400, detail="This download link is not valid.")
    if data.get("e", 0) < time.time():
        raise HTTPException(status_code=410, detail="This download link has expired. Run the analysis again for a fresh one.")
    return data


def token_ref(url: str) -> str:
    return "url:" + hashlib.sha256(url.encode()).hexdigest()[:40]


def gee_file_kind(value) -> str:
    """'raster' / 'vector' for Earth Engine file-download URLs; None for anything else (map tiles included)."""
    if not isinstance(value, str) or "earthengine.googleapis.com" not in value:
        return None
    try:
        u = urlparse(value)
    except ValueError:
        return None
    if not (u.hostname or "").endswith("earthengine.googleapis.com"):
        return None
    if ":getPixels" in u.path:
        return "raster"
    if ":getFeatures" in u.path:
        return "vector"
    return None


LINK_KEYS = ("download_url", "all_buildings_download_url", "url")


def wrap_links(obj):
    """Replace Earth Engine file URLs anywhere in a JSON value with paid download links."""
    if isinstance(obj, dict):
        for k, v in list(obj.items()):
            kind = gee_file_kind(v) if k in LINK_KEYS else None
            if kind:
                name = obj.get("name") or obj.get("filename") or obj.get("title") or obj.get("layerId")
                if k == "all_buildings_download_url":
                    name = "All buildings in the area"
                obj[k] = f"{FRONTEND_URL}/download/{make_token(v, kind, str(name) if name else None)}"
            else:
                wrap_links(v)
    elif isinstance(obj, list):
        for v in obj:
            wrap_links(v)
    return obj
