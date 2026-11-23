import os
from dotenv import load_dotenv

# Load mapniti-backend/.env explicitly — a bare load_dotenv() searches from the
# process's working directory and silently misses it when uvicorn is started
# from elsewhere (e.g. `--app-dir`), falling back to SQLite and default secrets.
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

GEE_PROJECT_ID = os.getenv("GEE_PROJECT_ID", "mapniti-app-final")
GEE_SERVICE_ACCOUNT_EMAIL = os.getenv("GEE_SERVICE_ACCOUNT_EMAIL")
GEE_SERVICE_ACCOUNT_KEY_PATH = os.getenv("GEE_SERVICE_ACCOUNT_KEY_PATH")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./mapniti.db")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
# Public addresses, used for share links and social-media previews (og:image).
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
PUBLIC_API_URL = os.getenv("PUBLIC_API_URL", "http://127.0.0.1:8000").rstrip("/")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "insecure-dev-secret-change-me")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "MapNiti")
OTP_EXPIRE_MINUTES = int(os.getenv("OTP_EXPIRE_MINUTES", "10"))

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
# AI assistant (Claude). Leave ANTHROPIC_API_KEY unset to disable the
# assistant — the endpoint then returns a clear "not configured" message.
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
AI_MODEL = os.getenv("AI_MODEL", "claude-opus-5")
AI_EFFORT = os.getenv("AI_EFFORT", "medium")

# Google Gemini is supported as an alternative provider.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
# "anthropic" | "gemini" — defaults to whichever key is configured (Anthropic first).
AI_PROVIDER = (os.getenv("AI_PROVIDER") or ("anthropic" if ANTHROPIC_API_KEY else "gemini" if GEMINI_API_KEY else "")).lower()

# AI rate limits (requests per rolling hour / day). Anonymous visitors of the
# public website get a smaller allowance than signed-in users.
AI_ANON_PER_HOUR = int(os.getenv("AI_ANON_PER_HOUR", "10"))
AI_ANON_PER_DAY = int(os.getenv("AI_ANON_PER_DAY", "30"))
AI_USER_PER_HOUR = int(os.getenv("AI_USER_PER_HOUR", "60"))
AI_USER_PER_DAY = int(os.getenv("AI_USER_PER_DAY", "300"))
# Only trust X-Forwarded-For when the API sits behind your own reverse proxy
# (nginx in docker-compose). Otherwise clients could spoof their IP.
TRUST_PROXY_HEADERS = os.getenv("TRUST_PROXY_HEADERS", "false").lower() == "true"
