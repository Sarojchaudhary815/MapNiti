import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database import engine, Base, run_migrations, db_info
from app.config import ALLOWED_ORIGINS
from app.models.message import ContactMessage  # noqa: F401 registers table for create_all
from app.models.learning import LessonProgress  # noqa: F401 registers table for create_all
from app.models.ai_usage import AiRequest  # noqa: F401 registers table for create_all
from app.models.article import Article  # noqa: F401 registers table for create_all
from app.models.analysis_run import AnalysisRun  # noqa: F401 registers table for create_all
from app.models.field import FieldSurvey, FieldRecord  # noqa: F401 registers tables for create_all
from app.services.analysis_jobs import recover_on_startup
from app.api import (website, hydrology, urban, agriculture, disaster, data_mgmt, auth, projects, admin, raster,
                     gee, engineering, ai, learn, analysis, downloads, articles, realtime, field)

Base.metadata.create_all(bind=engine)
run_migrations()
recover_on_startup()
app = FastAPI(title="MapNiti GIS API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
os.makedirs(os.path.join(_static_dir, "avatars"), exist_ok=True)
os.makedirs(os.path.join(_static_dir, "articles"), exist_ok=True)
os.makedirs(os.path.join(_static_dir, "field"), exist_ok=True)
app.mount("/static", StaticFiles(directory=_static_dir), name="static")

app.include_router(website.router, prefix="/api/website", tags=["Website"])
app.include_router(hydrology.router, prefix="/api/hydrology", tags=["Hydrology"])
app.include_router(urban.router, prefix="/api/urban", tags=["Urban"])
app.include_router(agriculture.router, prefix="/api/agriculture", tags=["Agriculture"])
app.include_router(disaster.router, prefix="/api/disaster", tags=["Disaster"])
app.include_router(data_mgmt.router, prefix="/api/data", tags=["Data Management"])
app.include_router(raster.router, prefix="/api/raster", tags=["Raster Analysis"])
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(realtime.router, prefix="/api/realtime", tags=["Live data"])
app.include_router(field.router, prefix="/api/field", tags=["Field data"])
app.include_router(gee.router, prefix="/api/gee", tags=["GEE Data Hub"])
app.include_router(engineering.router, prefix="/api/engineering", tags=["Engineer Toolkit"])
app.include_router(ai.router, prefix="/api/ai", tags=["AI Assistant"])
app.include_router(learn.router, prefix="/api/learn", tags=["Learning"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["Analysis Tools"])
app.include_router(downloads.router, prefix="/api/downloads", tags=["Data Download"])
app.include_router(articles.router, prefix="/api/articles", tags=["Articles"])
app.include_router(articles.share_router, prefix="/share", tags=["Share"])


@app.get("/")
async def root():
    return {"status": "online", "message": "MapNiti API is running", "version": "1.0.0"}


@app.get("/api/health")
async def health():
    """Liveness + which database is in use (for hosting checks)."""
    return {"status": "ok", "database": db_info()}
