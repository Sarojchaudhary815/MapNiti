from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, UniqueConstraint
from datetime import datetime
from app.database import Base


class LessonProgress(Base):
    """One row per completed lesson — course content itself lives in the frontend."""
    __tablename__ = "lesson_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    course_id = Column(String(64), nullable=False)
    lesson_id = Column(String(64), nullable=False)
    completed_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("user_id", "course_id", "lesson_id", name="uq_lesson_progress"),)
