# BurnCare — React + Flask + PostgreSQL

BurnCare recommends where a burn should be treated (burn unit, treat locally, or no treatment needed at home) using the BBA/NNBC referral criteria, the burn size (TBSA) and the AI burn depth. One Flask backend and one PostgreSQL database serve every page: guest, patient, healthcare staff and admin.

## 1. PostgreSQL

**New, empty database (first time only):** create a database called `burncare`, then run `backend/database/schema (1).sql` in the pgAdmin Query Tool.

> WARNING: `schema (1).sql` starts with DROP TABLE. Running it again DELETES all BurnCare data. Never run it on a database you want to keep.

**Existing database:** do not run the schema. Run only the migration files you have not run yet (each keeps your data):

| File | What it adds |
|---|---|
| `backend/database/staff_migration.sql` | staff fields |
| `backend/database/admin_levels_migration.sql` | admin levels (super admin / admin) |

## 2. Backend (first terminal, in `backend`)

```sh
python -m venv .venv
.venv\Scripts\activate          # Windows   (macOS: source .venv/bin/activate)
python -m pip install -r requirements.txt
copy .env.example .env          # Windows   (macOS: cp .env.example .env)
```

Open `backend/.env`, put your PostgreSQL password in `DATABASE_URL` and a long random `SECRET_KEY`. Never commit `.env`.

Create the first admin (a **super admin**) once:

```sh
python create_admin.py
```

Optional demo data (all passwords `Demo1234`, admin: `admin@burncare.demo`):

```sh
python seed_demo.py
```

Start the server:

```sh
python app.py
```

Check: http://localhost:5000/api/health

## 3. Frontend (second terminal, in `frontend`)

```sh
npm install
npm run dev
```

Open http://localhost:5173. All `/api/...` calls go to Flask on port 5000.

Main pages: `/`, `/about`, `/guest`, `/tbsa`, `/register`, `/login`, `/patient`, `/staff`, `/admin`.

## Admins

- **Super admin**: reviews staff requests and adds, deactivates and reactivates admins (Admin page, "Admins" tab).
- **Admin**: reviews staff requests only.
- A new admin receives an invitation email and sets their own password with "Forgot password" on the Log in page.
- Every admin login needs the password and a 6-digit code sent by email.
- All admins share one request list; the first decision wins and the activity log shows who decided.

## Emails

While `MAIL_SERVER` in `.env` is empty (development), no email is sent: login codes, reset codes and admin invitations are printed in the Flask terminal. To send real emails, fill in the Gmail settings shown in `.env.example` (use a Gmail App password).

## Troubleshooting

- Page not loading: both terminals must be running (`python app.py` in `backend`, `npm run dev` in `frontend`).
- Database error: check PostgreSQL is running and the password and database name in `.env`.
- "Can't import module": activate `.venv`, then run `python -m pip install -r requirements.txt` again; for the frontend run `npm install`.
- Never push `.env`, `.venv`, `node_modules`, `uploads` or real patient data to GitHub.
