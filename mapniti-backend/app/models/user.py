from sqlalchemy import Column, Integer, String, DateTime, Boolean
from datetime import datetime
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(150))
    email = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    country = Column(String(100), nullable=True)
    occupation = Column(String(20), nullable=True)  # "employed" | "student"
    organization = Column(String(200), nullable=True)  # company or college name
    role_title = Column(String(150), nullable=True)  # designation or faculty/program
    avatar_url = Column(String(255), nullable=True)
    is_admin = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)