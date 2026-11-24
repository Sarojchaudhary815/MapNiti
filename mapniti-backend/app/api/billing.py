"""Credits & billing: plans, balance, paying for exports, payment requests and
the admin side (approve payments, grant credits, payment details / QR)."""
import base64
import json
import os
import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import PUBLIC_API_URL
from app.database import get_db
from app.models.billing import CreditEntry, ExportCharge, PaymentRequest, BillingSetting
from app.models.user import User
from app.services import billing as B

router = APIRouter()

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
QR_DIR = os.path.join(BACKEND_DIR, "static", "billing")                 # public: buyers must see it
PROOF_DIR = os.path.join(BACKEND_DIR, "data", "payment_proofs")         # private: admins only
MAX_IMAGE = 3 * 1024 * 1024


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admins only.")
    return user


def _settings(db) -> dict:
    rows = {r.key: r.value for r in db.query(BillingSetting).all()}
    s = {k: rows.get(k, v) for k, v in B.DEFAULT_SETTINGS.items()}
    s["qr_url"] = f"{PUBLIC_API_URL}{s['qr_path']}" if s.get("qr_path") else None
    return s


def _iso(d):
    return d.isoformat() + "Z" if d else None


def _decode_image(data_url: str) -> tuple:
    m = re.match(r"^data:image/(jpeg|jpg|png|webp);base64,(.+)$", data_url or "", re.S)
    if not m:
        raise HTTPException(status_code=400, detail="Attach a JPEG, PNG or WebP image.")
    raw = base64.b64decode(m.group(2), validate=False)
    if len(raw) > MAX_IMAGE:
        raise HTTPException(status_code=400, detail="Image is larger than 3 MB.")
    if raw[:3] == b"\xff\xd8\xff":
        return raw, "jpg"
    if raw[:8] == b"\x89PNG\r\n\x1a\n":
        return raw, "png"
    if raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return raw, "webp"
    raise HTTPException(status_code=400, detail="That file is not a valid image.")


def _payment_out(p: PaymentRequest, user: User = None) -> dict:
    d = {"id": p.id, "pack_id": p.pack_id, "pack_name": B.PACK_BY_ID.get(p.pack_id, {}).get("name", p.pack_id),
         "amount_npr": p.amount_npr, "credits": p.credits, "unlimited_days": p.unlimited_days,
         "method": p.method, "method_label": B.METHODS.get(p.method, p.method), "txn_id": p.txn_id,
         "note": p.note, "status": p.status, "admin_note": p.admin_note, "has_proof": bool(p.proof_path),
         "created_at": _iso(p.created_at), "decided_at": _iso(p.decided_at)}
    if user is not None:
        d["user"] = {"id": user.id, "name": user.full_name, "email": user.email}
    return d


# ------------------------------------------------------------------ public / user

@router.get("/plans")
def plans(db: Session = Depends(get_db)):
    s = _settings(db)
    return {"packs": B.PACKS, "prices": B.PRICES, "kind_labels": B.KIND_LABELS, "welcome_credits": B.WELCOME_CREDITS,
            "methods": B.METHODS, "payment": {k: s[k] for k in ("account_name", "wallet_number", "instructions", "qr_url")}}


@router.get("/me")
def me(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    w = B.wallet(db, user.id)
    entries = (db.query(CreditEntry).filter(CreditEntry.user_id == user.id)
               .order_by(CreditEntry.created_at.desc(), CreditEntry.id.desc()).limit(30).all())
    pays = (db.query(PaymentRequest).filter(PaymentRequest.user_id == user.id)
            .order_by(PaymentRequest.created_at.desc()).limit(20).all())
    return {"balance": w.balance, "unlimited_until": _iso(w.unlimited_until), "unlimited": B.unlimited_active(w),
            "history": [{"delta": e.delta, "reason": e.reason, "note": e.note, "at": _iso(e.created_at)} for e in entries],
            "payments": [_payment_out(p) for p in pays]}


class ExportIn(BaseModel):
    kind: Optional[str] = Field(None, max_length=30)
    ref: Optional[str] = Field(None, max_length=200)
    label: Optional[str] = Field(None, max_length=200)
    token: Optional[str] = Field(None, max_length=4000)
    dry_run: bool = False


@router.post("/export")
def export(req: ExportIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Pay for one export. With `token` (a paid download link) it returns the real file URL.
    `dry_run` only quotes the price."""
    url = None
    if req.token:
        t = B.read_token(req.token)
        url, kind, ref, label = t["u"], t["k"], B.token_ref(t["u"]), t.get("n") or B.KIND_LABELS.get(t["k"])
    else:
        kind, ref, label = req.kind, req.ref, req.label
        if kind not in B.PRICES:
            raise HTTPException(status_code=400, detail="Unknown export type.")
        ref = f"x:{ref or label or kind}"[:120]
    if req.dry_run:
        return {**B.quote(db, user.id, kind, ref), "label": label}
    res = B.charge(db, user.id, kind, ref, label)
    return {**res, "label": label, **({"url": url} if url else {})}


class PaymentIn(BaseModel):
    pack_id: str = Field(..., max_length=30)
    method: str = Field(..., max_length=30)
    txn_id: str = Field(..., min_length=4, max_length=80)
    note: Optional[str] = Field(None, max_length=500)
    proof_data_url: Optional[str] = Field(None, max_length=5_000_000)


@router.post("/payments")
def submit_payment(req: PaymentIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    pack = B.PACK_BY_ID.get(req.pack_id)
    if not pack:
        raise HTTPException(status_code=400, detail="Choose a plan.")
    if req.method not in B.METHODS:
        raise HTTPException(status_code=400, detail="Choose how you paid.")
    txn = req.txn_id.strip()
    dup = (db.query(PaymentRequest)
           .filter(PaymentRequest.method == req.method, PaymentRequest.txn_id == txn, PaymentRequest.status != "rejected")
           .first())
    if dup:
        raise HTTPException(status_code=400, detail="This transaction ID was already submitted.")
    if db.query(PaymentRequest).filter(PaymentRequest.user_id == user.id, PaymentRequest.status == "pending").count() >= 5:
        raise HTTPException(status_code=429, detail="You already have 5 payments waiting for review.")
    p = PaymentRequest(user_id=user.id, pack_id=pack["id"], amount_npr=pack["price"], credits=pack["credits"],
                       unlimited_days=pack["days"], method=req.method, txn_id=txn,
                       note=(req.note or "").strip() or None)
    db.add(p)
    db.commit()
    db.refresh(p)
    if req.proof_data_url:
        raw, ext = _decode_image(req.proof_data_url)
        os.makedirs(PROOF_DIR, exist_ok=True)
        name = f"payment_{p.id}.{ext}"
        with open(os.path.join(PROOF_DIR, name), "wb") as fh:
            fh.write(raw)
        p.proof_path = name
        db.commit()
    return {"payment": _payment_out(p)}


# ------------------------------------------------------------------ admin

@router.get("/admin/payments")
def admin_payments(status: str = "pending", db: Session = Depends(get_db), _: User = Depends(require_admin)):
    q = db.query(PaymentRequest)
    if status != "all":
        q = q.filter(PaymentRequest.status == status)
    rows = q.order_by(PaymentRequest.created_at.desc()).limit(200).all()
    users = {u.id: u for u in db.query(User).filter(User.id.in_({p.user_id for p in rows})).all()} if rows else {}
    pending = db.query(PaymentRequest).filter(PaymentRequest.status == "pending").count()
    return {"payments": [_payment_out(p, users.get(p.user_id)) for p in rows], "pending": pending}


@router.get("/admin/payments/{pid}/proof")
def admin_proof(pid: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    p = db.query(PaymentRequest).filter(PaymentRequest.id == pid).first()
    if not p or not p.proof_path:
        raise HTTPException(status_code=404, detail="No screenshot.")
    path = os.path.join(PROOF_DIR, os.path.basename(p.proof_path))
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="No screenshot.")
    return FileResponse(path)


class DecisionIn(BaseModel):
    note: Optional[str] = Field(None, max_length=500)


def _pending(db, pid) -> PaymentRequest:
    p = db.query(PaymentRequest).filter(PaymentRequest.id == pid).with_for_update().first()
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found.")
    if p.status != "pending":
        raise HTTPException(status_code=400, detail=f"This payment is already {p.status}.")
    return p


@router.post("/admin/payments/{pid}/approve")
def approve(pid: int, req: DecisionIn, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    p = _pending(db, pid)
    p.status, p.admin_note, p.decided_at = "approved", (req.note or "").strip() or None, datetime.utcnow()
    db.commit()
    pack = B.PACK_BY_ID.get(p.pack_id, {}).get("name", p.pack_id)
    B.add_credits(db, p.user_id, p.credits, "purchase", f"{pack} · Rs {p.amount_npr} · {p.txn_id}", days=p.unlimited_days)
    return {"payment": _payment_out(p)}


@router.post("/admin/payments/{pid}/reject")
def reject(pid: int, req: DecisionIn, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    p = _pending(db, pid)
    p.status, p.admin_note, p.decided_at = "rejected", (req.note or "").strip() or "Payment not found", datetime.utcnow()
    db.commit()
    return {"payment": _payment_out(p)}


class GrantIn(BaseModel):
    email: str = Field(..., max_length=200)
    credits: int = Field(0, ge=-10000, le=10000)
    days: int = Field(0, ge=0, le=366)
    note: Optional[str] = Field(None, max_length=200)


@router.post("/admin/grant")
def grant(req: GrantIn, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    u = db.query(User).filter(User.email == req.email.strip().lower()).first() or \
        db.query(User).filter(User.email == req.email.strip()).first()
    if not u:
        raise HTTPException(status_code=404, detail="No user with that email.")
    if not req.credits and not req.days:
        raise HTTPException(status_code=400, detail="Give credits or days.")
    w = B.add_credits(db, u.id, req.credits, "grant", (req.note or f"Added by {admin.full_name}")[:255], days=req.days)
    return {"user": {"id": u.id, "name": u.full_name, "email": u.email}, "balance": w.balance,
            "unlimited_until": _iso(w.unlimited_until)}


@router.get("/admin/settings")
def get_settings(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return _settings(db)


class SettingsIn(BaseModel):
    account_name: Optional[str] = Field(None, max_length=120)
    wallet_number: Optional[str] = Field(None, max_length=60)
    instructions: Optional[str] = Field(None, max_length=1000)
    qr_data_url: Optional[str] = Field(None, max_length=5_000_000)
    remove_qr: bool = False


@router.put("/admin/settings")
def put_settings(req: SettingsIn, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    def put(key, value):
        row = db.query(BillingSetting).filter(BillingSetting.key == key).first()
        if row:
            row.value = value
        else:
            db.add(BillingSetting(key=key, value=value))

    for key in ("account_name", "wallet_number", "instructions"):
        v = getattr(req, key)
        if v is not None:
            put(key, v.strip())
    if req.qr_data_url:
        raw, ext = _decode_image(req.qr_data_url)
        os.makedirs(QR_DIR, exist_ok=True)
        for old in os.listdir(QR_DIR):
            if old.startswith("payment_qr"):
                os.remove(os.path.join(QR_DIR, old))
        name = f"payment_qr_{int(datetime.utcnow().timestamp())}.{ext}"   # new name busts browser caches
        with open(os.path.join(QR_DIR, name), "wb") as fh:
            fh.write(raw)
        put("qr_path", f"/static/billing/{name}")
    elif req.remove_qr:
        put("qr_path", "")
    db.commit()
    return _settings(db)


@router.get("/admin/exports")
def admin_exports(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    """Small summary for the admin dashboard."""
    total = db.query(ExportCharge).count()
    paid = db.query(ExportCharge).filter(ExportCharge.credits > 0).count()
    approved = db.query(PaymentRequest).filter(PaymentRequest.status == "approved").all()
    return {"exports": total, "paid_exports": paid, "revenue_npr": sum(p.amount_npr for p in approved),
            "approved_payments": len(approved)}


# ------------------------------------------------------------------ middleware

class ExportLinkMiddleware:
    """Pure ASGI middleware: in JSON responses from /api, swap Earth Engine file URLs
    for paid download links (see app.services.billing.wrap_links). Streaming and
    non-JSON responses pass straight through."""

    SKIP = ("/api/billing", "/api/ai")

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        path = scope.get("path", "")
        if scope["type"] != "http" or not path.startswith("/api/") or path.startswith(self.SKIP):
            await self.app(scope, receive, send)
            return

        start = {}
        chunks = []
        passthrough = False

        async def capture(message):
            nonlocal passthrough
            if message["type"] == "http.response.start":
                headers = dict((k.lower(), v) for k, v in message.get("headers", []))
                if b"application/json" not in headers.get(b"content-type", b""):
                    passthrough = True
                    await send(message)
                else:
                    start.update(message)
                return
            if passthrough:
                await send(message)
                return
            chunks.append(message.get("body", b""))
            if message.get("more_body"):
                return
            body = b"".join(chunks)
            if b"earthengine.googleapis.com" in body and b":get" in body:
                try:
                    body = json.dumps(B.wrap_links(json.loads(body))).encode()
                except ValueError:
                    pass
            headers = [(k, v) for k, v in start.get("headers", []) if k.lower() != b"content-length"]
            headers.append((b"content-length", str(len(body)).encode()))
            await send({**start, "headers": headers})
            await send({"type": "http.response.body", "body": body})

        await self.app(scope, receive, capture)
