"""Field data collection API: surveys (forms), offline sync of GPS records,
and export as GeoJSON / CSV."""
import base64
import csv
import io
import json
import os
import re
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.field import FieldSurvey, FieldRecord
from app.models.user import User

router = APIRouter()

STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "static")
PHOTO_DIR = os.path.join(STATIC_DIR, "field")
MAX_PHOTO = 3 * 1024 * 1024
FIELD_TYPES = {"text", "number", "select"}
DEFAULT_FIELDS = [
    {"key": "category", "label": "Category", "type": "select", "options": ["Building", "Road", "Bridge", "Drain", "Landslide", "Water source", "Other"]},
    {"key": "condition", "label": "Condition", "type": "select", "options": ["Good", "Fair", "Poor", "Damaged"]},
    {"key": "notes", "label": "Notes", "type": "text"},
]


class FieldDef(BaseModel):
    key: str = Field(..., max_length=40)
    label: str = Field(..., max_length=80)
    type: str = "text"
    options: Optional[List[str]] = None
    required: bool = False


class SurveyIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=160)
    description: Optional[str] = Field(None, max_length=2000)
    fields: Optional[List[FieldDef]] = None


class RecordIn(BaseModel):
    client_id: str = Field(..., min_length=8, max_length=64)
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    accuracy_m: Optional[float] = None
    altitude_m: Optional[float] = None
    data: dict = {}
    photo_data_url: Optional[str] = None
    recorded_at: Optional[str] = None


class SyncIn(BaseModel):
    records: List[RecordIn] = Field(..., max_length=200)


def _survey_out(s: FieldSurvey, count: int = 0) -> dict:
    return {"id": s.id, "name": s.name, "description": s.description, "fields": json.loads(s.fields_json or "[]"),
            "records": count, "created_at": s.created_at.isoformat() + "Z" if s.created_at else None}


def _own_survey(db, survey_id: int, user: User) -> FieldSurvey:
    s = db.query(FieldSurvey).filter(FieldSurvey.id == survey_id).first()
    if not s or (s.user_id != user.id and not user.is_admin):
        raise HTTPException(status_code=404, detail="Survey not found.")
    return s


def _clean_fields(fields):
    out, seen = [], set()
    for f in fields or []:
        key = re.sub(r"[^a-z0-9]+", "_", f.key.lower()).strip("_")[:40] or f"field_{len(out) + 1}"
        if key in seen or f.type not in FIELD_TYPES:
            continue
        seen.add(key)
        opts = [o.strip()[:80] for o in (f.options or []) if o.strip()][:50] if f.type == "select" else None
        out.append({"key": key, "label": f.label.strip(), "type": f.type, **({"options": opts} if opts else {}),
                    "required": bool(f.required)})
    return out[:30]


@router.get("/surveys")
def list_surveys(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(FieldSurvey).filter(FieldSurvey.user_id == user.id).order_by(FieldSurvey.created_at.desc()).all()
    counts = {s.id: db.query(FieldRecord).filter(FieldRecord.survey_id == s.id).count() for s in rows}
    return {"surveys": [_survey_out(s, counts[s.id]) for s in rows]}


@router.post("/surveys")
def create_survey(req: SurveyIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    fields = _clean_fields(req.fields) if req.fields else DEFAULT_FIELDS
    s = FieldSurvey(user_id=user.id, name=req.name.strip(), description=(req.description or "").strip() or None,
                    fields_json=json.dumps(fields))
    db.add(s)
    db.commit()
    db.refresh(s)
    return {"survey": _survey_out(s)}


@router.delete("/surveys/{survey_id}")
def delete_survey(survey_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    s = _own_survey(db, survey_id, user)
    for r in db.query(FieldRecord).filter(FieldRecord.survey_id == s.id).all():
        _remove_photo(r.photo_path)
        db.delete(r)
    db.delete(s)
    db.commit()
    return {"status": "success"}


def _save_photo(client_id: str, data_url: Optional[str]) -> Optional[str]:
    if not data_url:
        return None
    m = re.match(r"^data:image/(jpeg|jpg|png);base64,(.+)$", data_url, re.S)
    if not m:
        raise HTTPException(status_code=400, detail="Photo must be a JPEG or PNG image.")
    raw = base64.b64decode(m.group(2), validate=False)
    if len(raw) > MAX_PHOTO:
        raise HTTPException(status_code=400, detail="Photo is larger than 3 MB.")
    if not (raw[:3] == b"\xff\xd8\xff" or raw[:8] == b"\x89PNG\r\n\x1a\n"):
        raise HTTPException(status_code=400, detail="Photo is not a valid JPEG or PNG.")
    os.makedirs(PHOTO_DIR, exist_ok=True)
    name = f"{re.sub(r'[^A-Za-z0-9_-]', '', client_id)[:64]}.{'png' if raw[:4] == bytes([0x89, 0x50, 0x4E, 0x47]) else 'jpg'}"
    with open(os.path.join(PHOTO_DIR, name), "wb") as fh:
        fh.write(raw)
    return f"/static/field/{name}"


def _remove_photo(path):
    if path:
        try:
            os.remove(os.path.join(STATIC_DIR, path.replace("/static/", "", 1)))
        except OSError:
            pass


def _parse_time(s):
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).replace(tzinfo=None) if s else None
    except ValueError:
        return None


@router.post("/surveys/{survey_id}/sync")
def sync_records(survey_id: int, req: SyncIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Upload records captured offline. Records already on the server (same client_id) are skipped,
    so the phone can safely resend after a dropped connection."""
    s = _own_survey(db, survey_id, user)
    keys = {f["key"] for f in json.loads(s.fields_json or "[]")}
    saved, skipped, photo_errors = [], [], []
    for r in req.records:
        if db.query(FieldRecord).filter(FieldRecord.client_id == r.client_id).first():
            skipped.append(r.client_id)
            continue
        data = {k: (str(v)[:2000] if v is not None else None) for k, v in (r.data or {}).items() if k in keys}
        try:
            photo = _save_photo(r.client_id, r.photo_data_url)
        except HTTPException as e:   # keep the point; a bad photo must not block the rest of the queue
            photo = None
            photo_errors.append({"client_id": r.client_id, "error": e.detail})
        rec = FieldRecord(survey_id=s.id, user_id=user.id, client_id=r.client_id, lat=r.lat, lng=r.lng,
                          accuracy_m=r.accuracy_m, altitude_m=r.altitude_m, data_json=json.dumps(data),
                          photo_path=photo, recorded_at=_parse_time(r.recorded_at))
        db.add(rec)
        db.commit()
        saved.append(r.client_id)
    return {"status": "success", "saved": saved, "skipped": skipped, "photo_errors": photo_errors}


def _feature(r: FieldRecord, base_url=""):
    props = {"id": r.id, **json.loads(r.data_json or "{}"),
             "accuracy_m": round(r.accuracy_m, 1) if r.accuracy_m is not None else None,
             "recorded_at": r.recorded_at.isoformat() + "Z" if r.recorded_at else None,
             "photo_url": f"{base_url}{r.photo_path}" if r.photo_path else None}
    return {"type": "Feature", "geometry": {"type": "Point", "coordinates": [r.lng, r.lat]}, "properties": props}


@router.get("/surveys/{survey_id}/records")
def survey_records(survey_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    s = _own_survey(db, survey_id, user)
    rows = db.query(FieldRecord).filter(FieldRecord.survey_id == s.id).order_by(FieldRecord.recorded_at.desc()).all()
    from app.config import PUBLIC_API_URL
    return {"survey": _survey_out(s, len(rows)),
            "geojson": {"type": "FeatureCollection", "features": [_feature(r, PUBLIC_API_URL) for r in rows]}}


@router.delete("/records/{record_id}")
def delete_record(record_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    r = db.query(FieldRecord).filter(FieldRecord.id == record_id).first()
    if not r or (r.user_id != user.id and not user.is_admin):
        raise HTTPException(status_code=404, detail="Record not found.")
    _remove_photo(r.photo_path)
    db.delete(r)
    db.commit()
    return {"status": "success"}


@router.get("/surveys/{survey_id}/export.{fmt}")
def export(survey_id: int, fmt: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    s = _own_survey(db, survey_id, user)
    rows = db.query(FieldRecord).filter(FieldRecord.survey_id == s.id).order_by(FieldRecord.recorded_at).all()
    from app.config import PUBLIC_API_URL
    safe = re.sub(r"[^A-Za-z0-9_-]+", "_", s.name)[:60] or "survey"
    if fmt == "geojson":
        body = json.dumps({"type": "FeatureCollection", "name": s.name, "features": [_feature(r, PUBLIC_API_URL) for r in rows]})
        return Response(body, media_type="application/geo+json",
                        headers={"Content-Disposition": f'attachment; filename="{safe}.geojson"'})
    if fmt == "csv":
        fields = [f["key"] for f in json.loads(s.fields_json or "[]")]
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["id", "latitude", "longitude", "accuracy_m", "altitude_m", "recorded_at", *fields, "photo_url"])
        for r in rows:
            d = json.loads(r.data_json or "{}")
            w.writerow([r.id, r.lat, r.lng, r.accuracy_m, r.altitude_m, r.recorded_at.isoformat() if r.recorded_at else "",
                        *[d.get(k, "") for k in fields], f"{PUBLIC_API_URL}{r.photo_path}" if r.photo_path else ""])
        return Response("﻿" + buf.getvalue(), media_type="text/csv",
                        headers={"Content-Disposition": f'attachment; filename="{safe}.csv"'})
    raise HTTPException(status_code=400, detail="Export as geojson or csv.")
