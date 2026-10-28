"""
BurnCare — app.py   (the Flask backend)
-----------------------------------------------------------------------
Start the server with:
    python app.py
It runs on http://localhost:5000. The React site (Vite, port 5173)
sends every address that starts with /api to this server.

Files of the backend:
    app.py            this file: creates the app and connects the parts
    config.py         settings (database address, secret key, upload folder)
    db.py             the PostgreSQL connection and small SQL helpers
    validation.py     checks for names, emails, phones, passwords, SCFHS
    referral.py       the BBA referral decision (burn unit / local / none)
    auth.py           register, log in, log out, "who am I"
    admin.py          the Admin page: approve, reject, request changes ...
    assessments.py    save and read burn assessments
    consultations.py  staff ask burn specialists about a case
    mailer.py         sends emails (the admin login code)
    create_admin.py   creates the first admin account (run once)
    seed_demo.py      adds demo accounts for testing and the presentation
    database/schema.sql  creates the tables in PostgreSQL
"""

from flask import Flask, jsonify, request

import admin
import assessments
import auth
import consultations
import db
import patient
from config import Config
from flask_cors import CORS
from werkzeug.middleware.dispatcher import DispatcherMiddleware
from healthcare_staff.app import new_app as create_staff_app


def create_app():
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": "*"}})
    app.config.from_object(Config)

    # Close the database connection after every request.
    db.init_app(app)

    # Each "blueprint" is one group of API addresses (one file).
    app.register_blueprint(auth.bp)            # /api/auth/...
    app.register_blueprint(admin.bp)           # /api/admin/...
    app.register_blueprint(assessments.bp)     # /api/assessments/...
    app.register_blueprint(consultations.bp)   # /api/consultations/...
    app.register_blueprint(patient.bp)         # /api/patient/...

# Recovery Tracking: save and retrieve recovery timeline entries
    # mapped to table recovery_entries in PostgreSQL for TrackRecovery.jsx
    @app.route("/api/recovery", methods=["GET", "POST"])
    def handle_recovery():
        from auth import current_user
        user = current_user()
        if not user or user.get("role") != "patient" or not user.get("is_active"):
            return jsonify({"error": "Patient login required."}), 401
        patient_id = user["account_id"]
        if request.method == "POST":
            import os
            import random
            import string
            from werkzeug.utils import secure_filename

            entry_date = request.form.get("date")
            notes = request.form.get("notes", "").strip()
            selected_report = request.form.get("reportCode", "").strip()
            has_fever = request.form.get("hasFever") == "Yes"
            spreading_redness_or_pain = request.form.get("increasingRedness") == "Yes"
            warning_triggered = has_fever or spreading_redness_or_pain

            rand_suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
            entry_code = f"REC-{rand_suffix}"

            # If user selected a specific report, find its id; otherwise fallback to latest
            assessment_id = None
            if selected_report:
                found = db.query_one("SELECT assessment_id FROM assessments WHERE report_code = %s AND (patient_id = %s OR created_by = %s) LIMIT 1;", (selected_report, patient_id, patient_id))
                if found:
                    assessment_id = found.get("assessment_id")

            if not assessment_id:
                return jsonify({"error": "Choose one of your saved assessment reports first."}), 400

            photo = request.files.get("photo")
            photo_name = None
            photo_path = None

            if photo and photo.filename:
                photo_name = secure_filename(photo.filename)
                if not photo_name.lower().endswith((".png", ".jpg", ".jpeg")):
                    return jsonify({"error": "Upload a PNG or JPEG image."}), 400
                upload_dir = app.config.get("UPLOAD_FOLDER", "uploads")
                os.makedirs(upload_dir, exist_ok=True)
                from uuid import uuid4
                photo_path = os.path.join(upload_dir, f"{uuid4().hex}_{photo_name}")
                photo.save(photo_path)

            row = db.query_one("""
                INSERT INTO recovery_entries (
                    entry_code,
                    assessment_id,
                    entry_date,
                    photo_name,
                    photo_path,
                    has_fever,
                    spreading_redness_or_pain,
                    warning_triggered,
                    observation_notes
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING entry_id, entry_code, entry_date, photo_name, has_fever, spreading_redness_or_pain, warning_triggered, observation_notes, created_at;
            """, (entry_code, assessment_id, entry_date, photo_name, photo_path, has_fever, spreading_redness_or_pain, warning_triggered, notes))

            db.commit()
            return jsonify({
                "id": row.get("entry_code") or row.get("entry_id"),
                "date": str(row.get("entry_date")),
                "imageName": row.get("photo_name"),
                "notes": row.get("observation_notes"),
                "hasFever": "Yes" if row.get("has_fever") else "No",
                "increasingRedness": "Yes" if row.get("spreading_redness_or_pain") else "No",
                "warningTriggered": row.get("warning_triggered")
            }), 201

        # GET: retrieve timeline entries ordered by date
        rows = db.query_all("""
            SELECT r.entry_id, r.entry_code, r.entry_date, r.photo_name, r.has_fever, r.spreading_redness_or_pain, r.warning_triggered, r.observation_notes, r.created_at
            FROM recovery_entries r
            JOIN assessments a ON a.assessment_id = r.assessment_id
            WHERE a.patient_id = %s OR a.created_by = %s
            ORDER BY r.entry_date DESC, r.created_at DESC;
        """, (patient_id, patient_id))

        return jsonify([
            {
                "id": r.get("entry_code") or r.get("entry_id"),
                "date": str(r.get("entry_date")),
                "imageName": r.get("photo_name"),
                "notes": r.get("observation_notes"),
                "hasFever": "Yes" if r.get("has_fever") else "No",
                "increasingRedness": "Yes" if r.get("spreading_redness_or_pain") else "No",
                "warningTriggered": r.get("warning_triggered")
            }
            for r in rows
        ]), 200
    @app.get("/api/recovery/assessments")
    def recovery_assessments():
        # The recovery selector uses only the authenticated patient's own reports.
        from auth import current_user
        user = current_user()
        if not user or user.get("role") != "patient":
            return jsonify({"error": "Patient login required."}), 401
        records = db.query_all("""
            SELECT report_code, cause, age_group, decision, created_at
            FROM assessments WHERE patient_id = %s OR created_by = %s ORDER BY created_at DESC
        """, (user["account_id"], user["account_id"]))
        return jsonify([{
            "id": r["report_code"], "report_code": r["report_code"],
            "cause": r["cause"], "age_group": r["age_group"],
            "decision": r["decision"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        } for r in records])

    # A quick check that the server and the database are working.
    @app.get("/api/health")
    def health():
        db.query_one("SELECT 1 AS ok")
        return jsonify({"status": "ok", "database": "connected"})

    # Texts and team of the Home and About Us pages (tables site_content
    # and team_members), e.g. {"content": {"about.vision": "..."}, "team": [...]}
    @app.get("/api/site-content")
    def site_content():
        texts = db.query_all("SELECT content_key, text_value FROM site_content")
        team = db.query_all(
            "SELECT full_name, team_role, bio FROM team_members ORDER BY display_order, member_id"
        )
        return jsonify({
            "content": {row["content_key"]: row["text_value"] for row in texts},
            "team": [{"name": t["full_name"], "role": t["team_role"], "bio": t["bio"]} for t in team],
        })

    # Friendly JSON replies instead of HTML error pages.
    @app.errorhandler(404)
    def not_found(_error):
        return jsonify({"error": "Not found."}), 404

    @app.errorhandler(413)
    def too_large(_error):
        return jsonify({"error": "The file is too large (10 MB maximum)."}), 413

    @app.errorhandler(500)
    def server_error(_error):
        return jsonify({"error": "Something went wrong on the server. Please try again."}), 500

    return app


app = create_app()
# Keep staff demo data isolated in SQLite, while exposing both applications on one port.
app.wsgi_app = DispatcherMiddleware(app.wsgi_app, {"/staff": create_staff_app()})

if __name__ == "__main__":
    # debug=True restarts the server when you save a file (development only).
    app.run(port=5000, debug=True)