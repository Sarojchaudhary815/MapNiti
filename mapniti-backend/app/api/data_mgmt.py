import json
from typing import Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.digitize import DigitizedData
from app.api.projects import get_accessible_project

router = APIRouter()


@router.get("/status")
def get_data_status():
    return {"module": "data_management", "status": "active"}


class SaveDigitizeRequest(BaseModel):
    layerGroups: List[Any] = []
    featureCollection: Any = {"type": "FeatureCollection", "features": []}


@router.get("/{project_id}/digitize")
def load_digitize_data(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_accessible_project(project_id, current_user, db, require_role="viewer")
    row = db.query(DigitizedData).filter(DigitizedData.project_id == project_id).first()
    if not row:
        return {"status": "success", "layerGroups": [], "featureCollection": {"type": "FeatureCollection", "features": []}}
    return {
        "status": "success",
        "layerGroups": json.loads(row.layer_groups),
        "featureCollection": json.loads(row.feature_collection),
    }


@router.put("/{project_id}/digitize")
def save_digitize_data(
    project_id: int,
    data: SaveDigitizeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_accessible_project(project_id, current_user, db, require_role="editor")
    row = db.query(DigitizedData).filter(DigitizedData.project_id == project_id).first()
    if not row:
        row = DigitizedData(project_id=project_id)
        db.add(row)
    row.layer_groups = json.dumps(data.layerGroups)
    row.feature_collection = json.dumps(data.featureCollection)
    db.commit()
    return {"status": "success"}
