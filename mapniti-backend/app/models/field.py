"""Field data collection: a survey is a simple form; records are GPS points
captured on a phone (offline-first, synced later) with the form's answers."""
from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float

from app.database import Base


class FieldSurvey(Base):
    __tablename__ = "field_surveys"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(160), nullable=False)
    description = Column(Text)
    fields_json = Column(Text, nullable=False, default="[]")   # [{key, label, type: text|number|select, options?, required?}]
    created_at = Column(DateTime, default=datetime.utcnow)


class FieldRecord(Base):
    __tablename__ = "field_records"

    id = Column(Integer, primary_key=True, index=True)
    survey_id = Column(Integer, ForeignKey("field_surveys.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    client_id = Column(String(64), nullable=False, unique=True, index=True)   # made on the phone: makes sync safe to repeat
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    accuracy_m = Column(Float)
    altitude_m = Column(Float)
    data_json = Column(Text, nullable=False, default="{}")
    photo_path = Column(String(255))
    recorded_at = Column(DateTime)        # when it was captured in the field
    created_at = Column(DateTime, default=datetime.utcnow)   # when it reached the server
