"""One run of an analysis tool: the user's history, the background-job record and
the result cache (a finished run with the same tool + inputs is reused)."""
from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float

from app.database import Base, LongText


class AnalysisRun(Base):
    __tablename__ = "analysis_runs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    tool_id = Column(String(60), nullable=False, index=True)
    cache_key = Column(String(64), nullable=False, index=True)   # sha256 of tool + inputs

    aoi_name = Column(String(200))
    params_json = Column(Text)          # tool inputs except the geometry
    aoi_geojson = Column(LongText)

    status = Column(String(20), nullable=False, default="queued", index=True)  # queued | running | done | error
    result_json = Column(LongText)      # null when served from cache (see cached_from)
    error = Column(Text)
    cached_from = Column(Integer, nullable=True)   # id of the run whose result was reused
    seconds = Column(Float)             # compute time

    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    finished_at = Column(DateTime)
