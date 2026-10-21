"""
BurnCare — create_admin.py
-----------------------------------------------------------------------
Creates an admin account. Admins cannot register on the website (for
safety), so the first admin is created here, by the team, once:

    python create_admin.py

It asks for the name, email and password in the terminal.
"""

from getpass import getpass

from werkzeug.security import generate_password_hash

import validation as v
from app import app
from db import commit, execute, query_one


def main():
    print("Create a BurnCare admin account\n")
    name = input("Full name: ").strip()
    email = input("Email: ").strip().lower()
    phone = input("Saudi mobile number without 0 (e.g. 512345678): ").strip()
    job_title = input("Job title (e.g. System administrator): ").strip() or "System administrator"
    password = getpass("Password (hidden while you type): ")

    problem = (v.check_name(name) or v.check_email(email)
               or v.check_phone("SA", phone) or v.check_password(password))
    if problem:
        print("\nProblem:", problem)
        return

    with app.app_context():
        if query_one("SELECT 1 FROM accounts WHERE email = %s", (email,)):
            print("\nAn account with this email already exists.")
            return
        row = query_one(
            """
            INSERT INTO accounts (full_name, email, phone_country, phone, password_hash, role)
            VALUES (%s, %s, 'SA', %s, %s, 'admin') RETURNING account_id
            """,
            (name, email, v.full_phone("SA", phone), generate_password_hash(password)),
        )
        # Every admin also needs a row in admin_profiles (the admin subtype).
        execute("INSERT INTO admin_profiles (account_id, job_title) VALUES (%s, %s)",
                (row["account_id"], job_title))
        commit()
    print(f"\nAdmin account created for {email}. You can now log in on the website.")


if __name__ == "__main__":
    main()
