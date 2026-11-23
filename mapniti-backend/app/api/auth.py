import os
import uuid
import random
import secrets
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

import requests as http_requests

from app.database import get_db
from app.models.user import User
from app.auth import hash_password, verify_password, create_access_token, get_current_user
from app.config import OTP_EXPIRE_MINUTES, GOOGLE_CLIENT_ID
from app.services.email_service import send_otp_email

router = APIRouter()

AVATAR_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "static", "avatars")
ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}

# In-memory OTP store keyed by email. Short-lived by design (10 min expiry),
# so losing it on a server restart is not a real concern.
_otp_store: dict[str, dict] = {}


class SendOtpRequest(BaseModel):
    email: EmailStr


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    code: str


class GoogleLoginRequest(BaseModel):
    access_token: str  # from Google Identity Services' OAuth2 token client


class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    country: Optional[str] = None
    occupation: Optional[str] = None  # "employed" | "student"
    organization: Optional[str] = None
    role_title: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    country: Optional[str] = None
    occupation: Optional[str] = None
    organization: Optional[str] = None
    role_title: Optional[str] = None


def user_profile_dict(user: User) -> dict:
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "country": user.country,
        "occupation": user.occupation,
        "organization": user.organization,
        "role_title": user.role_title,
        "avatar_url": user.avatar_url,
        "is_admin": user.is_admin,
    }


@router.post("/send-otp")
def send_otp(data: SendOtpRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    code = f"{random.randint(0, 999999):06d}"
    _otp_store[data.email] = {
        "code": code,
        "expires_at": datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES),
        "verified": False,
    }

    try:
        send_otp_email(data.email, code)
    except Exception:
        del _otp_store[data.email]
        raise HTTPException(status_code=502, detail="Could not send the verification email. Please try again.")

    return {"status": "success", "message": "Verification code sent."}


@router.post("/verify-otp")
def verify_otp(data: VerifyOtpRequest):
    entry = _otp_store.get(data.email)
    if not entry:
        raise HTTPException(status_code=400, detail="Request a new code first.")
    if datetime.utcnow() > entry["expires_at"]:
        del _otp_store[data.email]
        raise HTTPException(status_code=400, detail="This code has expired. Please request a new one.")
    if not secrets.compare_digest(entry["code"], data.code.strip()):
        raise HTTPException(status_code=400, detail="Incorrect code. Please try again.")

    entry["verified"] = True
    return {"status": "success", "message": "Email verified."}


@router.post("/register")
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    otp_entry = _otp_store.get(data.email)
    if not otp_entry or not otp_entry.get("verified"):
        raise HTTPException(status_code=400, detail="Please verify your email first.")

    user = User(
        full_name=data.full_name,
        email=data.email,
        hashed_password=hash_password(data.password),
        country=data.country,
        occupation=data.occupation,
        organization=data.organization,
        role_title=data.role_title,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    _otp_store.pop(data.email, None)

    token = create_access_token({"sub": str(user.id)})
    return {
        "status": "success",
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "full_name": user.full_name, "email": user.email},
    }


@router.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = create_access_token({"sub": str(user.id)})
    return {
        "status": "success",
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "full_name": user.full_name, "email": user.email},
    }


@router.post("/google")
def google_login(data: GoogleLoginRequest, db: Session = Depends(get_db)):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google sign-in is not configured.")

    # Verify the token was actually issued for OUR app before trusting it —
    # otherwise a token minted for a different Google client could be replayed here.
    try:
        tokeninfo = http_requests.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"access_token": data.access_token},
            timeout=5,
        )
    except http_requests.RequestException:
        raise HTTPException(status_code=502, detail="Could not reach Google to verify the token.")

    if tokeninfo.status_code != 200 or tokeninfo.json().get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=401, detail="Invalid Google credential.")

    try:
        userinfo = http_requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {data.access_token}"},
            timeout=5,
        )
    except http_requests.RequestException:
        raise HTTPException(status_code=502, detail="Could not reach Google to verify the token.")

    if userinfo.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google credential.")

    payload = userinfo.json()
    email = payload.get("email")
    if not email or not payload.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google account email is not verified.")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            full_name=payload.get("name") or email.split("@")[0],
            email=email,
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            avatar_url=payload.get("picture"),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return {
        "status": "success",
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "full_name": user.full_name, "email": user.email},
    }


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return user_profile_dict(current_user)


@router.put("/me")
def update_me(
    data: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    for field, value in data.dict(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return user_profile_dict(current_user)


@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if file.content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(status_code=400, detail="Please upload a JPEG, PNG, WEBP, or GIF image.")

    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be smaller than 5MB.")

    os.makedirs(AVATAR_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1] or ".jpg"
    filename = f"user-{current_user.id}-{uuid.uuid4().hex[:8]}{ext}"
    file_path = os.path.join(AVATAR_DIR, filename)

    with open(file_path, "wb") as f:
        f.write(contents)

    current_user.avatar_url = f"/static/avatars/{filename}"
    db.commit()
    db.refresh(current_user)
    return user_profile_dict(current_user)
