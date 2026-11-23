"""
Copy every table from the local SQLite database (mapniti.db) into MySQL.

Usage (from mapniti-backend/):
    python scripts/migrate_sqlite_to_mysql.py "mysql+pymysql://USER:PASS@HOST:3306/mapniti?charset=utf8mb4"

Safe to re-run: tables that already contain rows in MySQL are skipped, so
it never duplicates data. Run it once, then set DATABASE_URL in .env to the
same MySQL URL and restart the API.
"""
import os
import sys

from sqlalchemy import create_engine, select, func, text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import Base  # noqa: E402
# Import every model so Base.metadata knows all tables.
from app.models import (user, project, collaborator, digitize, message, job, learning,  # noqa: E402,F401
                        ai_usage, article, analysis_run, field)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    if len(sys.argv) < 2 or not sys.argv[1].startswith("mysql"):
        print(__doc__)
        sys.exit(1)

    src = create_engine(f"sqlite:///{os.path.join(BASE_DIR, 'mapniti.db')}")
    dst = create_engine(sys.argv[1], pool_pre_ping=True)

    print("Creating tables in MySQL (if missing)...")
    Base.metadata.create_all(bind=dst)

    with src.connect() as s, dst.begin() as d:
        d.execute(text("SET FOREIGN_KEY_CHECKS=0"))
        src_tables = set(src.dialect.get_table_names(s))
        for table in Base.metadata.sorted_tables:
            if table.name not in src_tables:
                print(f"  {table.name:24s} not in SQLite — skipped")
                continue
            existing = d.execute(select(func.count()).select_from(table)).scalar()
            if existing:
                print(f"  {table.name:24s} already has {existing} rows in MySQL — skipped")
                continue
            src_cols = {c["name"] for c in src.dialect.get_columns(s, table.name)}
            cols = [c for c in table.columns if c.name in src_cols]
            rows = [dict(r._mapping) for r in s.execute(select(*cols))]
            if rows:
                d.execute(table.insert(), rows)
            print(f"  {table.name:24s} copied {len(rows)} rows")
        d.execute(text("SET FOREIGN_KEY_CHECKS=1"))
    print("Done. Now set DATABASE_URL in .env to this MySQL URL and restart the API.")


if __name__ == "__main__":
    main()
