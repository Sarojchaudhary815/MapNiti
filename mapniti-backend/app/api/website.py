from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from app.database import get_db
from app.models.message import ContactMessage

router = APIRouter()


class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    message: str


@router.post("/contact")
def contact(data: ContactRequest, db: Session = Depends(get_db)):
    entry = ContactMessage(name=data.name, email=data.email, message=data.message)
    db.add(entry)
    db.commit()
    return {"status": "success", "message": "Contact message received"}


@router.post("/apply")
def apply():
    return {"status": "success", "message": "Application received"}
