# BurnCare — integrated React + Flask project

This version connects the main BurnCare PostgreSQL-backed site and the **separate, local demonstration-only healthcare staff SQLite portal** to one backend server. It does NOT migrate or merge patient data between the databases. No real patient information should be entered into the demo staff portal.

## 1. PostgreSQL (first-time setup only)

Install/start PostgreSQL and create an empty database called `burncare`. **Only for a brand-new empty database**, run `backend/database/schema.sql` using pgAdmin Query Tool; WARNING: the schema file begins with DROP TABLE statements and WILL DELETE existing BurnCare data if run again. Never rerun it against an existing database without a backup. For an existing database, leave its tables untouched.

## 2. Backend terminal

On macOS, open Terminal in `2026-GP1-14/backend` and run:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` and replace `YOUR_PASSWORD` with your actual local PostgreSQL password. Set a unique, long SECRET_KEY. Do not commit or upload `.env`. Then run:

```sh
python app.py
```

Main health endpoint: http://localhost:5000/api/health (requires PostgreSQL). Staff demo health endpoint: http://localhost:5000/staff/api/health (SQLite; starts with the backend). SQLite staff data is saved under `backend/healthcare_staff/instance/burncare.db` automatically.

## 3. Frontend terminal

Open a **second** terminal in `2026-GP1-14/frontend`:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite, usually http://localhost:5173. Main pages: `/`, `/about`, `/guest`, `/tbsa`, `/register`, `/login`, `/patient`, `/patient/assessment`, `/patient/reports`, `/patient/recovery`, `/patient/profile`, `/admin`. Staff demo: `/staff`.

All main `/api/...` calls proxy to port 5000. Staff `/staff/api/...` calls are handled by the separate mounted SQLite app on the SAME port. Do not start `backend/healthcare_staff/app.py` as a second standalone server.

## Troubleshooting

- Page not loading: confirm both terminals are running; `npm run dev` must execute in `frontend`, and `python app.py` in `backend`.
- Main site health reports a database error: check PostgreSQL service, database name, password in `.env`, and pre-existing schema.
- Staff demo works but patient/admin doesn't: the staff demo uses SQLite, whereas the patient and admin APIs need PostgreSQL.
- Can't import module: activate `.venv` then reinstall `backend/requirements.txt`. Frontend modules require `npm install`.
- On a fresh staff portal, create/select a **demo** staff profile from `/staff` before editing or saving reports. This is *not* production authentication.
- Never include private `.env`, database instances, or real patient data in a public repository.

## Known limits

This project was statically checked for Python syntax and missing relative frontend imports in the supplied environment. An end-to-end run against your own PostgreSQL server and a full Vite production build have not been verified here. The two databases are intentionally separate. Existing placeholder/coming-soon features remain placeholders, not implemented clinical functionality.
