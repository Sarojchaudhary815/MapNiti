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


class Certificate(Base):
    """Issued when a user completes every lesson of a course and passes its final quiz.
    `code` is public and lets anyone verify the certificate."""
    __tablename__ = "certificates"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(16), nullable=False, unique=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    course_id = Column(String(64), nullable=False)
    course_title = Column(String(200), nullable=False)
    score = Column(Integer, nullable=False)          # percent
    issued_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("user_id", "course_id", name="uq_certificate_user_course"),)
