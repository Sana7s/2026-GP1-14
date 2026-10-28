"""
BurnCare — config.py
-----------------------------------------------------------------------
Settings for the backend. They are read from the ".env" file in this
folder (copy ".env.example" to ".env" and fill in your own password).
Keeping them in .env means passwords are not written in the code.
"""

import os

# Load the values from the .env file (if python-dotenv is installed).
BASE_FOLDER = os.path.dirname(os.path.abspath(__file__))

try:
    from dotenv import load_dotenv

    # Always read the .env that sits next to this file, even when Flask
    # is started from another folder (e.g. VS Code's Run button).
    load_dotenv(os.path.join(BASE_FOLDER, ".env"))
except ImportError:
    pass


class Config:
    # Address of the PostgreSQL database:
    #   postgresql://USER:PASSWORD@HOST:PORT/DATABASE_NAME
    DATABASE_URL = os.environ.get(
        "DATABASE_URL", "postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/burncare"
    )

    # Used to sign the login cookie. Change it to a long random text.
    SECRET_KEY = os.environ.get("SECRET_KEY", "change-this-secret-key")

    # Where burn photos are saved.
    UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", os.path.join(BASE_FOLDER, "uploads"))

    # Refuse uploads bigger than 11 MB (the photo limit is 10 MB).
    MAX_CONTENT_LENGTH = 11 * 1024 * 1024

    # Email settings (for the admin login code). Leave MAIL_SERVER empty
    # while developing: the code is then printed in the terminal instead.
    MAIL_SERVER = os.environ.get("MAIL_SERVER", "")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", "587"))
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME", "")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD", "")
    MAIL_FROM = os.environ.get("MAIL_FROM", "")

    # The login cookie cannot be read by JavaScript (safer).
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
