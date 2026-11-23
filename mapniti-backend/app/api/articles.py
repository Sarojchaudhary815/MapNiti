"""Community articles: publish a finished analysis to the public website and
share it on social media.

/api/articles          JSON API used by the React app
/share/articles/{slug} tiny HTML page with Open Graph tags; Facebook, WhatsApp
                       and others read these for the preview card, people are
                       redirected straight to the article on the website.
"""
import base64
import html
import json
import os
import re
import secrets
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import FRONTEND_URL, PUBLIC_API_URL
from app.database import get_db
from app.models.article import Article
from app.models.user import User

router = APIRouter()
share_router = APIRouter()

STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "static")
IMAGE_DIR = os.path.join(STATIC_DIR, "articles")
MAX_IMAGE_BYTES = 4 * 1024 * 1024
MAX_RESULT_CHARS = 1_000_000
RESULT_KEYS = ("title", "stats", "table", "chart", "legend", "notes")


class PublishRequest(BaseModel):
    title: str = Field(..., min_length=5, max_length=200)
    location: Optional[str] = Field(None, max_length=200)
    question: Optional[str] = Field(None, max_length=3000)
    findings: Optional[str] = Field(None, max_length=8000)
    tool_id: Optional[str] = Field(None, max_length=60)
    tool_label: Optional[str] = Field(None, max_length=120)
    module: Optional[str] = Field(None, max_length=60)
    result: dict[str, Any] = Field(default_factory=dict)
    aoi_geojson: Optional[dict[str, Any]] = None
    image_data_url: Optional[str] = None   # "data:image/jpeg;base64,..." snapshot of the map


def _slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return (s[:80].rstrip("-") or "analysis") + "-" + secrets.token_hex(3)


def _clean_result(result: dict) -> dict:
    """Keep only what the article shows. Map tile and download URLs from Earth
    Engine expire after a few hours, so they are never stored."""
    out = {k: result[k] for k in RESULT_KEYS if k in result}
    table = out.get("table")
    if isinstance(table, dict) and isinstance(table.get("rows"), list):
        table["rows"] = table["rows"][:200]
    if len(json.dumps(out, default=str)) > MAX_RESULT_CHARS:
        out.pop("table", None)
        out.pop("chart", None)
    return out


def _save_image(slug: str, data_url: Optional[str]) -> Optional[str]:
    if not data_url:
        return None
    m = re.match(r"^data:image/(jpeg|png);base64,([A-Za-z0-9+/=]+)$", data_url)
    if not m:
        raise HTTPException(status_code=400, detail="Map image must be a JPEG or PNG data URL.")
    raw = base64.b64decode(m.group(2))
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Map image is too large (max 4 MB).")
    is_jpeg, is_png = raw[:3] == b"\xff\xd8\xff", raw[:8] == b"\x89PNG\r\n\x1a\n"
    if not (is_jpeg or is_png):
        raise HTTPException(status_code=400, detail="Map image is not a valid JPEG or PNG.")
    os.makedirs(IMAGE_DIR, exist_ok=True)
    name = f"{slug}.{'jpg' if is_jpeg else 'png'}"
    with open(os.path.join(IMAGE_DIR, name), "wb") as f:
        f.write(raw)
    return f"/static/articles/{name}"


def _author(user: Optional[User]) -> dict:
    if not user:
        return {"name": "MapNiti user"}
    return {"name": user.full_name or "MapNiti user", "organization": user.organization,
            "role": user.role_title, "avatar_url": user.avatar_url}


def _public(a: Article, db: Session, full: bool = True) -> dict:
    user = db.query(User).filter(User.id == a.user_id).first()
    d = {
        "slug": a.slug, "title": a.title, "location": a.location, "module": a.module,
        "tool_id": a.tool_id, "tool_label": a.tool_label,
        "summary": (a.question or "")[:220],
        "image_url": f"{PUBLIC_API_URL}{a.image_path}" if a.image_path else None,
        "author": _author(user), "author_id": a.user_id,
        "views": a.views, "created_at": a.created_at.isoformat() if a.created_at else None,
        "share_url": f"{PUBLIC_API_URL}/share/articles/{a.slug}",
        "url": f"{FRONTEND_URL}/case-studies/{a.slug}",
    }
    if full:
        d.update({
            "question": a.question, "findings": a.findings,
            "result": json.loads(a.result_json or "{}"),
            "aoi_geojson": json.loads(a.aoi_geojson) if a.aoi_geojson else None,
        })
    return d


@router.post("")
def publish(req: PublishRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    result = _clean_result(req.result or {})
    if not result.get("stats") and not result.get("table"):
        raise HTTPException(status_code=400, detail="Run an analysis first: there are no results to publish.")
    slug = _slugify(req.title)
    image_path = _save_image(slug, req.image_data_url)
    a = Article(
        slug=slug, user_id=user.id, title=req.title.strip(), location=(req.location or "").strip() or None,
        question=(req.question or "").strip() or None, findings=(req.findings or "").strip() or None,
        tool_id=req.tool_id, tool_label=req.tool_label, module=req.module,
        result_json=json.dumps(result, default=str),
        aoi_geojson=json.dumps(req.aoi_geojson) if req.aoi_geojson else None,
        image_path=image_path,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return {"status": "success", "article": _public(a, db)}


@router.get("")
def list_articles(limit: int = 30, offset: int = 0, db: Session = Depends(get_db)):
    limit = max(1, min(limit, 100))
    q = db.query(Article).filter(Article.is_published.is_(True)).order_by(Article.created_at.desc())
    return {"articles": [_public(a, db, full=False) for a in q.offset(offset).limit(limit).all()],
            "total": q.count()}


@router.get("/mine")
def my_articles(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Article).filter(Article.user_id == user.id).order_by(Article.created_at.desc())
    return {"articles": [_public(a, db, full=False) for a in q.all()]}


@router.get("/{slug}")
def get_article(slug: str, db: Session = Depends(get_db)):
    a = db.query(Article).filter(Article.slug == slug, Article.is_published.is_(True)).first()
    if not a:
        raise HTTPException(status_code=404, detail="Article not found.")
    a.views = (a.views or 0) + 1
    db.commit()
    return _public(a, db)


@router.delete("/{slug}")
def delete_article(slug: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    a = db.query(Article).filter(Article.slug == slug).first()
    if not a:
        raise HTTPException(status_code=404, detail="Article not found.")
    if a.user_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="Only the author or an admin can delete this article.")
    if a.image_path:
        try:
            os.remove(os.path.join(STATIC_DIR, a.image_path.replace("/static/", "", 1)))
        except OSError:
            pass
    db.delete(a)
    db.commit()
    return {"status": "success"}


@share_router.get("/articles/{slug}", response_class=HTMLResponse)
def share_page(slug: str, db: Session = Depends(get_db)):
    a = db.query(Article).filter(Article.slug == slug, Article.is_published.is_(True)).first()
    target = f"{FRONTEND_URL}/case-studies/{slug}" if a else f"{FRONTEND_URL}/case-studies"
    if not a:
        return HTMLResponse(f'<!doctype html><meta http-equiv="refresh" content="0;url={html.escape(target)}">', status_code=404)
    e = html.escape
    title = f"{a.title}" + (f" · {a.location}" if a.location else "")
    desc = (a.question or a.findings or f"{a.tool_label or 'GIS analysis'} published on MapNiti.").replace("\n", " ")[:280]
    image = f"{PUBLIC_API_URL}{a.image_path}" if a.image_path else f"{FRONTEND_URL}/assets/MapNiti_logo_transparent.png"
    page = f"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>{e(title)} | MapNiti</title>
<meta name="description" content="{e(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="MapNiti">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:image" content="{e(image)}">
<meta property="og:url" content="{e(f'{PUBLIC_API_URL}/share/articles/{slug}')}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{e(title)}">
<meta name="twitter:description" content="{e(desc)}">
<meta name="twitter:image" content="{e(image)}">
<link rel="canonical" href="{e(target)}">
<meta http-equiv="refresh" content="0;url={e(target)}">
</head><body>
<p>Opening <a href="{e(target)}">{e(a.title)}</a> on MapNiti…</p>
<script>location.replace({json.dumps(target)});</script>
</body></html>"""
    return HTMLResponse(page)
