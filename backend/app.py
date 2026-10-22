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

from flask import Flask, jsonify

import admin
import assessments
import auth
import consultations
import db
from config import Config


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Close the database connection after every request.
    db.init_app(app)

    # Each "blueprint" is one group of API addresses (one file).
    app.register_blueprint(auth.bp)            # /api/auth/...
    app.register_blueprint(admin.bp)           # /api/admin/...
    app.register_blueprint(assessments.bp)     # /api/assessments/...
    app.register_blueprint(consultations.bp)   # /api/consultations/...

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

if __name__ == "__main__":
    # debug=True restarts the server when you save a file (development only).
    app.run(port=5000, debug=True)
