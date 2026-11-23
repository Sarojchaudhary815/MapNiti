from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Index
from datetime import datetime
from app.database import Base


class AiRequest(Base):
    """One row per assistant request — used for per-user / per-IP rate limits."""
    __tablename__ = "ai_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    ip = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (Index("ix_ai_requests_ip_time", "ip", "created_at"),
                      Index("ix_ai_requests_user_time", "user_id", "created_at"))
