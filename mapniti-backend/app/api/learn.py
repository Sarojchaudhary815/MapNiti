from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.learning import LessonProgress
from app.models.user import User

router = APIRouter()


class ProgressUpdate(BaseModel):
    course_id: str = Field(..., max_length=64)
    lesson_id: str = Field(..., max_length=64)
    completed: bool = True


@router.get("/progress")
def get_progress(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.query(LessonProgress).filter(LessonProgress.user_id == current_user.id).all()
    progress = {}
    for r in rows:
        progress.setdefault(r.course_id, []).append(r.lesson_id)
    return {"status": "success", "progress": progress}


@router.post("/progress")
def set_progress(data: ProgressUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = (db.query(LessonProgress)
           .filter(LessonProgress.user_id == current_user.id,
                   LessonProgress.course_id == data.course_id,
                   LessonProgress.lesson_id == data.lesson_id)
           .first())
    if data.completed and not row:
        db.add(LessonProgress(user_id=current_user.id, course_id=data.course_id, lesson_id=data.lesson_id))
        db.commit()
    elif not data.completed and row:
        db.delete(row)
        db.commit()
    return {"status": "success"}
