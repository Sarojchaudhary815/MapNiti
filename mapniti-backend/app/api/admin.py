from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.project import Project
from app.models.collaborator import ProjectCollaborator
from app.auth import get_current_user

router = APIRouter()


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    result = []
    for u in users:
        project_count = db.query(Project).filter(Project.user_id == u.id).count()
        result.append({
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "country": u.country,
            "is_admin": u.is_admin,
            "project_count": project_count,
            "created_at": u.created_at,
        })
    return {"status": "success", "users": result}


@router.get("/stats")
def admin_stats(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    from app.models.project import AnalysisResult
    return {
        "status": "success",
        "total_users": db.query(User).count(),
        "total_projects": db.query(Project).count(),
        "total_analyses": db.query(AnalysisResult).count(),
        "total_shared_projects": db.query(ProjectCollaborator.project_id).distinct().count(),
    }
