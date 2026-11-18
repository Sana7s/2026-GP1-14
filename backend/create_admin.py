"""
BurnCare — create_admin.py
-----------------------------------------------------------------------
Creates the FIRST admin account (a "super admin"). Nobody can register
as an admin on the website (for safety), so the first one is created
here, by the team, once:

    python create_admin.py

It asks for the name, email and password in the terminal.

After that, this super admin adds the other admins from the website:
Admin page → "Admins" tab → "Add admin".
  super admin = reviews staff requests AND can add / deactivate admins
  admin       = reviews staff requests only
"""

from getpass import getpass

from werkzeug.security import generate_password_hash

import validation as v
from app import app
from db import commit, execute, query_one


def main():
    print("Create a BurnCare super admin account\n")
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
        # An admin created here is a super admin (admin_level = 'super').
        execute("INSERT INTO admin_profiles (account_id, job_title, admin_level) VALUES (%s, %s, 'super')",
                (row["account_id"], job_title))
        commit()
    print(f"\nSuper admin account created for {email}. You can now log in on the website.")


if __name__ == "__main__":
    main()
