# MapNiti — Hosting Guide (MySQL)

MapNiti runs on SQLite locally and on **MySQL 8 / MariaDB 10.6+** in production.
The switch is one setting: `DATABASE_URL` in `mapniti-backend/.env`.

```
DATABASE_URL=mysql+pymysql://mapniti_user:STRONG_PASSWORD@HOST:3306/mapniti?charset=utf8mb4
```

Tables are created automatically on first start. Check what's live at `GET /api/health`
(it returns `"database": {"dialect": "mysql"}` once MySQL is in use).

---

## Option A — VPS with Docker (recommended)

Works on any Ubuntu VPS (DigitalOcean, Linode, AWS Lightsail, a Nepal VPS, ...). 2 vCPU / 4 GB RAM is enough.

```bash
git clone <your repo> mapniti && cd mapniti
cp mapniti-backend/.env.example mapniti-backend/.env   # fill in secrets
mkdir -p mapniti-backend/secrets                         # put gee-key.json here
export MYSQL_PASSWORD='a-strong-password' MYSQL_ROOT_PASSWORD='another-one'
docker compose up -d --build
```

This starts three containers: `mysql`, `backend` (FastAPI + gunicorn) and `frontend` (nginx serving the React build and proxying `/api` to the backend). Open `http://SERVER_IP`.

**HTTPS:** point your domain at the server, then put Caddy in front (`caddy reverse-proxy --from your-domain.com --to :80`) or use Certbot with nginx.

## Option B — VPS without Docker

1. Install MySQL and create the database:
   ```sql
   CREATE DATABASE mapniti CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'mapniti_user'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD';
   GRANT ALL PRIVILEGES ON mapniti.* TO 'mapniti_user'@'localhost';
   FLUSH PRIVILEGES;
   ```
2. Backend:
   ```bash
   cd mapniti-backend
   python3 -m venv venv && source venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env    # set DATABASE_URL, JWT_SECRET_KEY, GEE_*, ANTHROPIC_API_KEY, ALLOWED_ORIGINS
   gunicorn main:app -k uvicorn.workers.UvicornWorker -w 4 -b 127.0.0.1:8000 --timeout 300
   ```
   Run it under `systemd` so it restarts on reboot.
3. Frontend:
   ```bash
   cd frontend
   REACT_APP_API_URL=https://api.your-domain.com npm run build
   ```
   Serve `frontend/build/` with nginx (see `frontend/nginx.conf` for the SPA + proxy config).

## Option C — cPanel shared hosting

Works if your host offers **"Setup Python App"** (Passenger) and MySQL.

1. cPanel → **MySQL Databases**: create the database and user, and add the user to the database with ALL PRIVILEGES.
2. Upload `mapniti-backend/`, create a Python 3.11 app in "Setup Python App", run `pip install -r requirements.txt` in its virtualenv, and set the env vars from `.env.example`. Use `localhost` as the MySQL host.
3. Build the frontend locally with `REACT_APP_API_URL=https://api.your-domain.com npm run build` and upload `build/` to `public_html`. Add an `.htaccess` rewrite so every route goes to `index.html`.

> Many shared hosts kill long requests after 30–60 s. Large GEE analyses can take longer, so a VPS is the safer choice.

---

## Moving existing data from SQLite to MySQL

```bash
cd mapniti-backend
python scripts/migrate_sqlite_to_mysql.py "mysql+pymysql://USER:PASS@HOST:3306/mapniti?charset=utf8mb4"
```

The script creates the tables, then copies users, projects, results, collaborators, digitized data, messages and lesson progress. It skips any table that already has rows, so running it twice is safe.

Large JSON columns (digitized layers, analysis results) use `LONGTEXT` on MySQL — plain `TEXT` is capped at 64 KB and would reject big digitizing projects. Existing MySQL databases are upgraded automatically at startup.

## Google Earth Engine on a server

`earthengine authenticate` needs a browser, so servers use a **service account**:

1. Google Cloud Console → your GEE project → IAM → Service Accounts → create one → create a JSON key.
2. Register the service account for Earth Engine: code.earthengine.google.com/register (or add the *Earth Engine Resource Viewer/Writer* role on the project).
3. Set `GEE_SERVICE_ACCOUNT_EMAIL` and `GEE_SERVICE_ACCOUNT_KEY_PATH` in `.env`.

## AI assistant

Set `ANTHROPIC_API_KEY` (from console.anthropic.com). The default is `AI_MODEL=claude-opus-5`, and you can change the model and `AI_EFFORT` in `.env`. If no key is set, the assistant tab shows a "not configured" message and everything else keeps working.

The assistant is available on the public website (`/ai`) and inside the tools. To control cost, requests are rate-limited per rolling hour/day and stored in the `ai_requests` table: `AI_ANON_PER_HOUR/DAY` for visitors (by IP), `AI_USER_PER_HOUR/DAY` for logged-in users. Behind nginx/Caddy set `TRUST_PROXY_HEADERS=true` so the real client IP is used (docker-compose already does).

## Public vs. logged-in areas

- **Public (no login):** Home, Learn GIS courses (`/learn`), Code Lab (`/code-lab`), GIS Guide (`/gis-guide`), What's New (`/whats-new`), Data Sources (`/data-sources`), AI (`/ai`).
- **Login (`/tool`):** analysis tools (Urban, Disaster, Hydrology, Agriculture, Data Management, GEE Data Hub, Engineer Toolkit), Data Download, AI Assistant.

## Nepal boundaries cache

The AOI picker's "Nepal" button serves province / district / palika boundaries (geoBoundaries, CC BY 4.0) through the API. They are downloaded once from GitHub and cached in `mapniti-backend/static/boundaries/` — keep that folder writable. In Docker it lives inside the container and is simply re-downloaded after a rebuild (first request takes ~10–30 s; pre-warm with `curl http://localhost:8000/api/downloads/boundaries/NPL/ADM3`).

## Production checklist

- [ ] `JWT_SECRET_KEY` is a long random string (`python -c "import secrets;print(secrets.token_urlsafe(48))"`)
- [ ] `ALLOWED_ORIGINS` lists only your real domain(s)
- [ ] MySQL user has rights only on the `mapniti` database
- [ ] Nightly DB backup: `mysqldump --single-transaction mapniti | gzip > mapniti-$(date +%F).sql.gz`
- [ ] HTTPS enabled
- [ ] `.env` and `secrets/` are never committed
