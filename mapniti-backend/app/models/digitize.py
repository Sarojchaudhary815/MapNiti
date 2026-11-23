from sqlalchemy import Column, Integer, Text, ForeignKey, DateTime
from datetime import datetime
from app.database import Base, LongText


class DigitizedData(Base):
    """One row per project — mirrors the frontend's in-memory digitize state
    (layerGroups + featureCollection) exactly so save/load needs no
    reshaping on either side."""
    __tablename__ = "digitized_data"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, unique=True, index=True)
    layer_groups = Column(LongText, nullable=False, default="[]")
    feature_collection = Column(LongText, nullable=False, default='{"type":"FeatureCollection","features":[]}')
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
