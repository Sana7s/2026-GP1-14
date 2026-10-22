"""
BurnCare — seed_demo.py
-----------------------------------------------------------------------
Adds DEMO accounts so you can test the website and show it in the
presentation. Run it once, after schema.sql:

    python seed_demo.py

Every demo account uses the password:  Demo1234
  admin@burncare.demo       Admin
  patient@burncare.demo     Patient (Sara Ahmed)
  specialist@burncare.demo  Burn specialist (approved)
  doctor@burncare.demo      Doctor (approved)
  + 5 staff requests waiting for the admin (pending)

Do NOT use these accounts on a real system.
"""

from datetime import datetime, timezone

from werkzeug.security import generate_password_hash

from app import app
from db import commit, execute, query_one

PASSWORD = generate_password_hash("Demo1234")


def add_account(name, email, phone, role):
    """Create one account (if it does not exist yet) and return its id."""
    found = query_one("SELECT account_id FROM accounts WHERE email = %s", (email,))
    if found:
        return found["account_id"], False
    row = query_one(
        """
        INSERT INTO accounts (full_name, email, phone_country, phone, password_hash, role)
        VALUES (%s, %s, 'SA', %s, %s, %s) RETURNING account_id
        """,
        (name, email, phone, PASSWORD, role),
    )
    return row["account_id"], True


def add_staff(name, email, phone, staff_role, scfhs, status, hours_ago, admin_id=None, other=None):
    account_id, new = add_account(name, email, phone, "staff")
    if new:
        approved = status == "approved"
        execute(
            """
            INSERT INTO staff_profiles (account_id, staff_role, staff_role_other, scfhs_number, status,
                submitted_at, reviewed_at, reviewed_by)
            VALUES (%s, %s, %s, %s, %s, NOW() - (%s * INTERVAL '1 hour'), %s, %s)
            """,
            (account_id, staff_role, other, scfhs, status, hours_ago,
             datetime.now(timezone.utc) if approved else None, admin_id if approved else None),
        )
        if status == "approved":
            execute(
                "INSERT INTO staff_reviews (staff_account_id, admin_id, action) VALUES (%s, %s, 'approve')",
                (account_id, admin_id),
            )


def main():
    with app.app_context():
        admin_id, new = add_account("BurnCare Admin", "admin@burncare.demo", "+966500000001", "admin")
        if new:
            # Admins also need a row in admin_profiles (the admin subtype).
            execute("INSERT INTO admin_profiles (account_id, job_title) VALUES (%s, 'System administrator')",
                    (admin_id,))

        patient_id, new = add_account("Sara Ahmed", "patient@burncare.demo", "+966500000002", "patient")
        if new:
            execute(
                """
                INSERT INTO patient_profiles (account_id, date_of_birth, sex, weight_kg, height_cm, consent_given)
                VALUES (%s, '1998-04-12', 'Female', 62, 163, TRUE)
                """,
                (patient_id,),
            )

        # Approved staff
        add_staff("Dr. Reem Al-Otaibi", "specialist@burncare.demo", "+966500000003",
                  "burn_specialist", "11RM0012093", "approved", 200, admin_id)
        add_staff("Dr. Saad Al-Ghamdi", "doctor@burncare.demo", "+966500000004",
                  "doctor", "15RM0028810", "approved", 150, admin_id)

        # Requests waiting for the admin
        add_staff("Dr. Khalid Al-Harbi", "khalid@burncare.demo", "+966551234567",
                  "burn_specialist", "14RM0045821", "pending", 3)
        add_staff("Noura Al-Qahtani", "noura@burncare.demo", "+966508765432",
                  "nurse", "19RN0023317", "pending", 52)
        add_staff("Faisal Al-Mutairi", "faisal@burncare.demo", "+966542223344",
                  "ems", "21RE0009934", "pending", 20)
        add_staff("Dr. Huda Al-Shehri", "huda@burncare.demo", "+966561119080",
                  "doctor", "16RM0031207", "pending", 6)
        add_staff("Omar Hassan", "omar@burncare.demo", "+971507654321",
                  "doctor", "16RM0031207", "pending", 2)  # same SCFHS number → "Possible duplicate"
        commit()
    print("Demo accounts are ready. Password for all of them: Demo1234")


if __name__ == "__main__":
    main()
