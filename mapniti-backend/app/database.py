import os
from sqlalchemy import create_engine, text, inspect, Text
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app import config

# Anchor the SQLite file to this backend's own directory so the server always
# opens the same database regardless of the process's working directory.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DEFAULT_SQLITE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'mapniti.db')}"

# Honor DATABASE_URL from the environment (e.g. mysql+pymysql://user:pass@host/db
# for shared hosting) when it's actually been set to something real; otherwise
# fall back to the absolute-path SQLite default above so local dev always opens
# the same file regardless of cwd.
_env_url = config.DATABASE_URL
if _env_url and _env_url != "sqlite:///./mapniti.db":
    SQLALCHEMY_DATABASE_URL = _env_url
else:
    SQLALCHEMY_DATABASE_URL = _DEFAULT_SQLITE_URL

IS_SQLITE = SQLALCHEMY_DATABASE_URL.startswith("sqlite")
IS_MYSQL = SQLALCHEMY_DATABASE_URL.startswith("mysql")

if IS_SQLITE:
    # SQLite-only kwarg — MySQL/PyMySQL rejects it outright.
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # Hosted MySQL servers drop idle connections (wait_timeout, often 8h or
    # less on shared hosting), so recycle before that and ping on checkout
    # instead of surfacing "MySQL server has gone away" to users.
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=int(os.getenv("DB_POOL_RECYCLE", "280")),
        pool_size=int(os.getenv("DB_POOL_SIZE", "10")),
        max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "20")),
        connect_args={"charset": "utf8mb4"} if IS_MYSQL else {},
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# MySQL TEXT caps at 64 KB — digitized layers and analysis results are JSON
# blobs that easily reach megabytes, so they need LONGTEXT (4 GB) there.
# SQLite/Postgres keep plain TEXT, which has no such limit.
LongText = Text().with_variant(LONGTEXT(), "mysql")

# Columns that must be LONGTEXT on MySQL; run_migrations() upgrades
# databases created before this was introduced.
LONGTEXT_COLUMNS = {
    "digitized_data": ["layer_groups", "feature_collection"],
    "analysis_results": ["input_geometry", "result_data"],
    "articles": ["result_json", "aoi_geojson"],
    "analysis_runs": ["result_json", "aoi_geojson"],
}

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# create_all() never alters tables that already exist, so newly added
# nullable columns on already-created tables need an explicit ADD COLUMN.
# This runs on both SQLite and MySQL (an existing MySQL DB created before a
# column was added needs it just as much).
NEW_COLUMNS = {
    "users": [
        ("country", "VARCHAR(100)"),
        ("occupation", "VARCHAR(20)"),
        ("organization", "VARCHAR(200)"),
        ("role_title", "VARCHAR(150)"),
        ("avatar_url", "VARCHAR(255)"),
        ("is_admin", "BOOLEAN DEFAULT 0"),
    ],
    "projects": [
        ("is_public", "BOOLEAN DEFAULT 0"),
    ],
}


def run_migrations():
    insp = inspect(engine)
    existing_tables = set(insp.get_table_names())
    with engine.begin() as conn:
        for table, columns in NEW_COLUMNS.items():
            if table not in existing_tables:
                continue  # create_all() will create it with all columns
            existing = {c["name"] for c in insp.get_columns(table)}
            for name, sql_type in columns:
                # "BOOLEAN DEFAULT 0" is valid on both SQLite and MySQL.
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {sql_type}"))
        if engine.dialect.name == "mysql":
            for table, cols in LONGTEXT_COLUMNS.items():
                if table not in existing_tables:
                    continue
                types = {c["name"]: str(c["type"]).upper() for c in insp.get_columns(table)}
                for col in cols:
                    if col in types and "LONGTEXT" not in types[col]:
                        conn.execute(text(f"ALTER TABLE {table} MODIFY {col} LONGTEXT"))


# Backwards-compatible name used by main.py before MySQL support.
run_sqlite_migrations = run_migrations


def db_info() -> dict:
    """Which backend is live — surfaced on the public /api/health, so only the
    dialect (never host, path or credentials)."""
    return {"dialect": engine.dialect.name}
