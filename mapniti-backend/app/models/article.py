"""Community articles: an analysis a user ran in the tool, written up and
published on the public website (Case Studies), shareable on social media."""
from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean

from app.database import Base, LongText


class Article(Base):
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(160), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    title = Column(String(200), nullable=False)
    location = Column(String(200))
    question = Column(Text)            # why the analysis was done
    findings = Column(Text)            # the author's interpretation, one point per line
    tool_id = Column(String(60))       # e.g. "disaster-flood"
    tool_label = Column(String(120))
    module = Column(String(60))        # e.g. "Disaster Risk"

    result_json = Column(LongText)     # stats, table, chart, legend, notes from the tool run
    aoi_geojson = Column(LongText)
    image_path = Column(String(255))   # map snapshot under /static/articles/

    is_published = Column(Boolean, default=True, nullable=False)
    views = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
