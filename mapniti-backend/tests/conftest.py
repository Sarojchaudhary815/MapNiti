"""Test setup: every run uses a throw-away SQLite database, never the real
MySQL from .env, and no Earth Engine or network calls."""
import os
import sys
import tempfile
import uuid

import pytest

_tmp = tempfile.mkdtemp(prefix="mapniti-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(_tmp, 'test.db')}"
os.environ["JWT_SECRET_KEY"] = "test-secret"
os.environ.setdefault("FRONTEND_URL", "https://mapniti.example")
os.environ.setdefault("PUBLIC_API_URL", "https://api.mapniti.example")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from app.auth import create_access_token, hash_password  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models.user import User  # noqa: E402


@pytest.fixture(scope="session")
def client():
    return TestClient(main.app)


def _make_user(is_admin=False):
    db = SessionLocal()
    try:
        u = User(full_name="Test User", email=f"t-{uuid.uuid4().hex[:10]}@example.com",
                 hashed_password=hash_password(uuid.uuid4().hex), country="Nepal",
                 occupation="engineer", is_admin=is_admin)
        db.add(u)
        db.commit()
        db.refresh(u)
        return u.id
    finally:
        db.close()


@pytest.fixture
def auth():
    """Headers for a fresh, ordinary user."""
    uid = _make_user()
    return {"Authorization": f"Bearer {create_access_token({'sub': str(uid)})}"}


@pytest.fixture
def other_auth():
    uid = _make_user()
    return {"Authorization": f"Bearer {create_access_token({'sub': str(uid)})}"}
