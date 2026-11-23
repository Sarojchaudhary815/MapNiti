"""
MapNiti AI — a GIS / remote-sensing / civil-engineering assistant backed by
Claude or Google Gemini (AI_PROVIDER). Streams plain-text chunks so the chat UI
renders as it arrives.
"""
import logging
from datetime import datetime, timedelta
from typing import List, Literal, Optional

import anthropic
from google import genai
from google.genai import types as genai_types
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.auth import get_optional_user
from app.config import (ANTHROPIC_API_KEY, AI_MODEL, AI_EFFORT, AI_ANON_PER_HOUR, AI_ANON_PER_DAY,
                        AI_USER_PER_HOUR, AI_USER_PER_DAY, TRUST_PROXY_HEADERS,
                        GEMINI_API_KEY, GEMINI_MODEL, AI_PROVIDER)
from app.database import get_db
from app.models.ai_usage import AiRequest
from app.models.user import User

logger = logging.getLogger("mapniti.ai")
router = APIRouter()

SYSTEM_PROMPT = """You are MapNiti AI, the assistant inside MapNiti — a web GIS platform for engineers in Nepal and South Asia.

Who you help: civil engineers, geomatics/survey engineers, hydrologists, urban planners, agriculture and disaster-risk professionals, and students learning GIS.

What you are expert in:
- GIS and cartography: vector/raster, projections and datums (WGS84, UTM 44N/45N, Nepal's MUTM on Everest 1830 with central meridians 81°, 84°, 87°), topology, spatial analysis, QGIS, ArcGIS, PostGIS, GDAL.
- Remote sensing and Google Earth Engine (JavaScript and Python/geemap): Sentinel-1/2, Landsat, MODIS, DEMs (SRTM, Copernicus, ALOS), spectral indices, classification, change detection, time series.
- Civil engineering uses of geospatial data: road alignment and grades, earthwork (cut/fill), drainage and culvert sizing (rational method, SCS-CN), watershed/hydrology (HEC-HMS, HEC-RAS), slope stability screening, site suitability, surveying (levelling, traverse, total station, GNSS/RTK), land units (ropani/aana/paisa/daam, bigha/kattha/dhur).
- Nepal context: NBC codes (e.g. NBC 105:2020 seismic), Department of Roads norms, Survey Department / NGIIS data, DHM hydro-met data, Bipad disaster portal, municipal building bylaws. Say clearly when a figure should be checked against the latest official document.
- Programming for geospatial work: Python (geopandas, rasterio, shapely, xarray, earthengine-api), JavaScript (Leaflet, MapLibre, Turf), SQL/PostGIS.

MapNiti's own tools you can point users to: GEE Data Hub (30+ datasets with stats, time series and GeoTIFF download), Engineer Toolkit (site report, point inspector, elevation profile, calculators: coordinates, units, earthwork, rational method, Manning, levelling), Hydrology (watershed, flood, rainfall-runoff), Data Management (NDVI/NDWI/NDBI, LULC, raster calculator, digitizing), Learn GIS courses and the Code Lab.

How to answer:
- Be practical and specific. Give formulas with units, worked numbers, and runnable code when code helps.
- Reply in the user's language; if they write in Nepali or romanized Nepali, you may answer in simple Nepali/English mix.
- If a site-specific engineering decision depends on field data, say what test or survey is needed. Don't invent official data values, dataset IDs or URLs — say when you're unsure.
- Use Markdown: short headings, bullet points, and fenced code blocks with a language tag.
- In Leaflet / MapLibre examples use Esri basemap tiles (street: https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}, imagery: .../World_Imagery/MapServer/tile/{z}/{y}/{x}, attribution "Tiles © Esri"). tile.openstreetmap.org blocks embedded previews such as MapNiti's Code Lab, and CARTO now needs an API key.
- Write formulas in plain text with Unicode symbols (e.g. Q = C × i × A / 360, m³/s) — never LaTeX or $…$, the chat cannot render it."""


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=20000)


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., min_length=1, max_length=40)
    context: Optional[str] = Field(None, max_length=4000)  # e.g. current AOI / tool summary


_client: Optional[anthropic.AsyncAnthropic] = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    return _client


_gemini: Optional[genai.Client] = None


def _get_gemini() -> genai.Client:
    global _gemini
    if _gemini is None:
        _gemini = genai.Client(api_key=GEMINI_API_KEY)
    return _gemini


def _ai_enabled() -> bool:
    return (AI_PROVIDER == "anthropic" and bool(ANTHROPIC_API_KEY)) or (AI_PROVIDER == "gemini" and bool(GEMINI_API_KEY))


def _model_name() -> str:
    return AI_MODEL if AI_PROVIDER == "anthropic" else GEMINI_MODEL


# Tried in order when a model is overloaded (503), rate-limited (429) or retired (404).
GEMINI_FALLBACKS = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-flash-lite-latest"]


async def _stream_gemini(messages, max_tokens):
    contents = [genai_types.Content(role="model" if m["role"] == "assistant" else "user",
                                    parts=[genai_types.Part(text=m["content"])]) for m in messages]
    config = genai_types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        max_output_tokens=max_tokens,
        automatic_function_calling=genai_types.AutomaticFunctionCallingConfig(disable=True),
    )
    models = [GEMINI_MODEL] + [m for m in GEMINI_FALLBACKS if m != GEMINI_MODEL]
    last_error = ""
    for model in models:
        sent_any = False
        try:
            stream = await _get_gemini().aio.models.generate_content_stream(model=model, contents=contents, config=config)
            finish = None
            async for chunk in stream:
                if chunk.text:
                    sent_any = True
                    yield chunk.text
                if chunk.candidates and chunk.candidates[0].finish_reason:
                    finish = str(chunk.candidates[0].finish_reason)
            if finish and "MAX_TOKENS" in finish:
                yield "\n\n_(Answer was cut off — ask me to continue.)_"
            elif finish and "SAFETY" in finish:
                yield "\n\n_I can't help with that request._"
            return
        except Exception as exc:  # noqa: BLE001 — try the next model, then report readably
            last_error = str(exc)
            logger.warning("Gemini %s error: %s", model, exc)
            overloaded = any(k in last_error for k in ("503", "UNAVAILABLE", "429", "RESOURCE_EXHAUSTED", "404", "NOT_FOUND"))
            if sent_any or not overloaded:
                break  # can't restart a half-streamed answer; non-capacity errors won't fix themselves
    if "API key" in last_error or "PERMISSION_DENIED" in last_error or "401" in last_error or "403" in last_error:
        yield "AI error: the server's GEMINI_API_KEY is invalid or not permitted."
    elif any(k in last_error for k in ("503", "UNAVAILABLE", "429", "RESOURCE_EXHAUSTED")):
        yield "The AI service is very busy right now. Please try again in a minute."
    else:
        yield "AI error. Please try again."


def _client_ip(request: Request) -> str:
    if TRUST_PROXY_HEADERS:
        fwd = request.headers.get("x-forwarded-for")
        if fwd:
            return fwd.split(",")[0].strip()[:64]
    return (request.client.host if request.client else "unknown")[:64]


def _check_and_record(db: Session, user: Optional[User], ip: str):
    """Rolling-window rate limit stored in the database, so it holds across
    gunicorn workers and restarts."""
    now = datetime.utcnow()
    q = db.query(AiRequest)
    q = q.filter(AiRequest.user_id == user.id) if user else q.filter(AiRequest.user_id.is_(None), AiRequest.ip == ip)
    per_hour, per_day = (AI_USER_PER_HOUR, AI_USER_PER_DAY) if user else (AI_ANON_PER_HOUR, AI_ANON_PER_DAY)
    if q.filter(AiRequest.created_at >= now - timedelta(hours=1)).count() >= per_hour:
        hint = "." if user else ", or log in for a higher limit."
        raise HTTPException(429, "You've reached the hourly limit for the AI assistant. Please try again later" + hint)
    if q.filter(AiRequest.created_at >= now - timedelta(days=1)).count() >= per_day:
        raise HTTPException(429, "Daily AI limit reached. Please come back tomorrow.")
    db.add(AiRequest(user_id=user.id if user else None, ip=ip))
    db.commit()


@router.get("/status")
def ai_status(current_user: Optional[User] = Depends(get_optional_user)):
    return {
        "enabled": _ai_enabled(),
        "provider": AI_PROVIDER if _ai_enabled() else None,
        "model": _model_name() if _ai_enabled() else None,
        "signed_in": bool(current_user),
        "limits": {"per_hour": AI_USER_PER_HOUR if current_user else AI_ANON_PER_HOUR,
                   "per_day": AI_USER_PER_DAY if current_user else AI_ANON_PER_DAY},
    }


@router.post("/chat")
async def chat(req: ChatRequest, request: Request, db: Session = Depends(get_db),
               current_user: Optional[User] = Depends(get_optional_user)):
    if not _ai_enabled():
        async def not_configured():
            yield ("The AI assistant isn't configured on this server yet. An admin needs to set "
                   "`ANTHROPIC_API_KEY` or `GEMINI_API_KEY` in the backend `.env` file and restart the API.")
        return StreamingResponse(not_configured(), media_type="text/plain; charset=utf-8")

    _check_and_record(db, current_user, _client_ip(request))
    # Anonymous visitors get shorter answers to keep the public assistant affordable.
    max_tokens = 16000 if current_user else 6000
    user_tag = f"mapniti-{current_user.id}" if current_user else "mapniti-public"

    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    if messages[0]["role"] != "user":
        messages = messages[1:]
    if req.context and messages:
        messages[-1]["content"] = f"<map_context>\n{req.context}\n</map_context>\n\n{messages[-1]['content']}"

    if AI_PROVIDER == "gemini":
        return StreamingResponse(_stream_gemini(messages, max_tokens), media_type="text/plain; charset=utf-8",
                                 headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

    async def generate():
        try:
            async with _get_client().beta.messages.stream(
                model=AI_MODEL,
                max_tokens=max_tokens,
                system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
                messages=messages,
                thinking={"type": "adaptive"},
                output_config={"effort": AI_EFFORT},
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
                metadata={"user_id": user_tag},
            ) as stream:
                async for text in stream.text_stream:
                    yield text
                final = await stream.get_final_message()
                if final.stop_reason == "refusal":
                    yield "\n\n_I can't help with that request._"
                elif final.stop_reason == "max_tokens":
                    yield "\n\n_(Answer was cut off — ask me to continue.)_"
        except anthropic.AuthenticationError:
            yield "AI error: the server's ANTHROPIC_API_KEY is invalid."
        except anthropic.RateLimitError:
            yield "AI is busy right now (rate limit). Please try again in a minute."
        except anthropic.APIStatusError as exc:
            logger.warning("Claude API error %s: %s", exc.status_code, exc.message)
            yield f"AI error ({exc.status_code}). Please try again."
        except anthropic.APIConnectionError:
            yield "Could not reach the AI service. Check the server's internet connection."

    return StreamingResponse(generate(), media_type="text/plain; charset=utf-8",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
