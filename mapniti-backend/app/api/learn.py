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


# ---------------------------------------------------------------------------
# Final quizzes and certificates
# ---------------------------------------------------------------------------
import random  # noqa: E402
import secrets  # noqa: E402
from typing import List  # noqa: E402

from fastapi import HTTPException  # noqa: E402

from app.models.learning import Certificate  # noqa: E402
from app.services.quiz_bank import QUIZZES, TITLES, PASS_MARK  # noqa: E402


def _quiz(course_id: str) -> dict:
    q = QUIZZES.get(course_id)
    if not q:
        raise HTTPException(status_code=404, detail="This course has no quiz.")
    return q


def _lessons_done(db, user_id: int, course_id: str) -> int:
    return db.query(LessonProgress).filter(LessonProgress.user_id == user_id, LessonProgress.course_id == course_id).count()


def _cert_out(c: Certificate, name: str = None) -> dict:
    return {"code": c.code, "course_id": c.course_id, "course_title": c.course_title, "score": c.score,
            "issued_at": c.issued_at.isoformat() + "Z" if c.issued_at else None,
            **({"name": name} if name is not None else {})}


@router.get("/quiz/{course_id}")
def get_quiz(course_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Questions only; options are shuffled and the answers never leave the server."""
    q = _quiz(course_id)
    cert = db.query(Certificate).filter(Certificate.user_id == current_user.id, Certificate.course_id == course_id).first()
    rng = random.Random()
    questions = []
    for i, (text, options, _answer, _why) in enumerate(q["questions"]):
        opts = list(options)
        rng.shuffle(opts)
        questions.append({"i": i, "question": text, "options": opts})
    return {"course_id": course_id, "title": TITLES.get(course_id, course_id), "pass_mark": int(PASS_MARK * 100),
            "lessons_required": q["lessons"], "lessons_done": _lessons_done(db, current_user.id, course_id),
            "questions": questions, "certificate": _cert_out(cert, current_user.full_name) if cert else None}


class QuizAnswers(BaseModel):
    answers: List[str] = Field(..., max_length=50)   # the chosen option's text, in question order


@router.post("/quiz/{course_id}")
def submit_quiz(course_id: str, data: QuizAnswers, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = _quiz(course_id)
    qs = q["questions"]
    if len(data.answers) != len(qs):
        raise HTTPException(status_code=400, detail="Answer every question.")
    review, correct = [], 0
    for (text, options, answer, why), chosen in zip(qs, data.answers):
        ok = chosen == options[answer]
        correct += ok
        review.append({"question": text, "chosen": chosen, "correct": ok, "answer": options[answer], "explanation": why})
    score = round(100 * correct / len(qs))
    passed = correct / len(qs) >= PASS_MARK
    done = _lessons_done(db, current_user.id, course_id)

    cert = db.query(Certificate).filter(Certificate.user_id == current_user.id, Certificate.course_id == course_id).first()
    if passed and done >= q["lessons"]:
        if not cert:
            cert = Certificate(code=secrets.token_hex(5).upper(), user_id=current_user.id, course_id=course_id,
                               course_title=TITLES.get(course_id, course_id), score=score)
            db.add(cert)
            db.commit()
            db.refresh(cert)
        elif score > cert.score:   # a better retake raises the score on the certificate
            cert.score = score
            db.commit()
    return {"score": score, "passed": passed, "correct": correct, "total": len(qs), "review": review,
            "lessons_required": q["lessons"], "lessons_done": done,
            "certificate": _cert_out(cert, current_user.full_name) if cert else None}


@router.get("/certificates")
def my_certificates(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.query(Certificate).filter(Certificate.user_id == current_user.id).order_by(Certificate.issued_at.desc()).all()
    return {"certificates": [_cert_out(c, current_user.full_name) for c in rows]}


@router.get("/certificates/verify/{code}")
def verify_certificate(code: str, db: Session = Depends(get_db)):
    """Public: anyone with the code (e.g. an employer) can check a certificate is real."""
    c = db.query(Certificate).filter(Certificate.code == code.strip().upper()[:16]).first()
    if not c:
        raise HTTPException(status_code=404, detail="No certificate with this code.")
    u = db.query(User).filter(User.id == c.user_id).first()
    return {"valid": True, **_cert_out(c, u.full_name if u else "MapNiti learner")}
