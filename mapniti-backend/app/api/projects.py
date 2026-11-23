import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional, Any

from app.database import get_db
from app.models.project import Project, AnalysisResult
from app.models.collaborator import ProjectCollaborator
from app.models.user import User
from app.auth import get_current_user

router = APIRouter()


class CreateProjectRequest(BaseModel):
    name: str


class SaveResultRequest(BaseModel):
    module: str
    tool_type: str
    input_geometry: Optional[Any] = None
    result_data: Optional[Any] = None


class AddCollaboratorRequest(BaseModel):
    email: EmailStr
    role: str = "viewer"  # "viewer" | "editor"


def _accessible_projects_query(db: Session, current_user: User):
    """Projects the user owns OR has been added to as a collaborator."""
    return (
        db.query(Project)
        .outerjoin(ProjectCollaborator, ProjectCollaborator.project_id == Project.id)
        .filter(or_(Project.user_id == current_user.id, ProjectCollaborator.user_id == current_user.id))
        .distinct()
    )


def get_accessible_project(project_id: int, current_user: User, db: Session, require_role: str = "viewer") -> Project:
    """
    require_role: "viewer" (read-only is enough) or "editor" (must be able to write).
    Owner always passes. A collaborator passes if their role satisfies the
    requirement (editor satisfies both). 404 (not 403) is used for "no access"
    too, so a project's existence isn't leaked to users without any access.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id == current_user.id:
        return project

    collab = (
        db.query(ProjectCollaborator)
        .filter(ProjectCollaborator.project_id == project_id, ProjectCollaborator.user_id == current_user.id)
        .first()
    )
    if not collab:
        raise HTTPException(status_code=404, detail="Project not found")
    if require_role == "editor" and collab.role != "editor":
        raise HTTPException(status_code=403, detail="You only have viewer access to this project")
    return project


@router.post("")
def create_project(
    data: CreateProjectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = Project(name=data.name, user_id=current_user.id)
    db.add(project)
    db.commit()
    db.refresh(project)
    return {"status": "success", "project": {"id": project.id, "name": project.name}}


@router.get("")
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    projects = _accessible_projects_query(db, current_user).all()
    return {
        "status": "success",
        "projects": [{"id": p.id, "name": p.name, "created_at": p.created_at} for p in projects],
    }


@router.get("/overview")
def projects_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Overview page को लागि — हरेक project मा कति analysis (module-wise)
    गरिएको छ भन्ने summary एकैचोटि फर्काउँछ।
    """
    projects = _accessible_projects_query(db, current_user).all()
    overview = []
    for p in projects:
        results = db.query(AnalysisResult).filter(AnalysisResult.project_id == p.id).all()
        module_counts = {}
        for r in results:
            module_counts[r.module] = module_counts.get(r.module, 0) + 1
        overview.append({
            "id": p.id,
            "name": p.name,
            "created_at": p.created_at,
            "total_analyses": len(results),
            "module_counts": module_counts,
            "is_owner": p.user_id == current_user.id,
        })
    return {"status": "success", "projects": overview}


@router.post("/{project_id}/results")
def save_result(
    project_id: int,
    data: SaveResultRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_accessible_project(project_id, current_user, db, require_role="editor")

    result = AnalysisResult(
        project_id=project.id,
        module=data.module,
        tool_type=data.tool_type,
        input_geometry=json.dumps(data.input_geometry) if data.input_geometry else None,
        result_data=json.dumps(data.result_data) if data.result_data else None,
    )
    db.add(result)
    db.commit()
    db.refresh(result)
    return {"status": "success", "result_id": result.id}


@router.get("/{project_id}/results")
def list_results(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_accessible_project(project_id, current_user, db, require_role="viewer")

    results = db.query(AnalysisResult).filter(AnalysisResult.project_id == project_id).all()
    return {
        "status": "success",
        "results": [
            {
                "id": r.id,
                "module": r.module,
                "tool_type": r.tool_type,
                "input_geometry": json.loads(r.input_geometry) if r.input_geometry else None,
                "result_data": json.loads(r.result_data) if r.result_data else None,
                "created_at": r.created_at,
            }
            for r in results
        ],
    }


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Deleting stays owner-only — collaborators (even editors) never delete.
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    db.query(AnalysisResult).filter(AnalysisResult.project_id == project_id).delete()
    db.query(ProjectCollaborator).filter(ProjectCollaborator.project_id == project_id).delete()
    db.delete(project)
    db.commit()
    return {"status": "success", "message": "Project deleted"}


@router.get("/{project_id}/collaborators")
def list_collaborators(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_accessible_project(project_id, current_user, db, require_role="viewer")
    collaborators = db.query(ProjectCollaborator).filter(ProjectCollaborator.project_id == project_id).all()
    result = []
    for c in collaborators:
        u = db.query(User).filter(User.id == c.user_id).first()
        result.append({
            "id": c.id,
            "user_id": c.user_id,
            "email": u.email if u else None,
            "full_name": u.full_name if u else None,
            "role": c.role,
        })
    return {"status": "success", "collaborators": result, "is_owner": project.user_id == current_user.id}


@router.post("/{project_id}/collaborators")
def add_collaborator(
    project_id: int,
    data: AddCollaboratorRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Owner-only — sharing/role changes are not delegated to editors.
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if data.role not in ("viewer", "editor"):
        raise HTTPException(status_code=400, detail="Role must be 'viewer' or 'editor'")

    target = db.query(User).filter(User.email == data.email).first()
    if not target:
        raise HTTPException(status_code=404, detail="No user found with that email")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="You already own this project")

    existing = (
        db.query(ProjectCollaborator)
        .filter(ProjectCollaborator.project_id == project_id, ProjectCollaborator.user_id == target.id)
        .first()
    )
    if existing:
        existing.role = data.role
    else:
        db.add(ProjectCollaborator(project_id=project_id, user_id=target.id, role=data.role))
    db.commit()
    return {"status": "success"}


@router.delete("/{project_id}/collaborators/{collaborator_id}")
def remove_collaborator(
    project_id: int,
    collaborator_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    db.query(ProjectCollaborator).filter(
        ProjectCollaborator.id == collaborator_id, ProjectCollaborator.project_id == project_id
    ).delete()
    db.commit()
    return {"status": "success"}
