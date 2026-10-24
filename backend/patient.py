"""
BurnCare — patient.py
-----------------------------------------------------------------------
The patient's own profile (the Profile page, /patient/profile).

API addresses (all start with /api/patient, patients only):
  GET  /profile   the signed-in patient's details
  PUT  /profile   save changes

Tables: accounts (name, phone) and patient_profiles (date of birth, sex,
weight, height, chronic condition, allergy, medication).
The email is shown but can't be changed here: it is the sign-in name,
so changing it would need its own email check.
"""

from flask import Blueprint, jsonify, request

import validation as v
from auth import current_user, error, public_user, role_required
from db import commit, execute, query_one

bp = Blueprint("patient", __name__, url_prefix="/api/patient")

MAX_TEXT = 120  # same as the chronic_condition / allergy / medication columns


def profile_json(account_id):
    row = query_one(
        """
        SELECT a.full_name, a.email, a.phone_country, a.phone,
               TO_CHAR(p.date_of_birth, 'YYYY-MM-DD') AS dob, p.sex, p.weight_kg, p.height_cm,
               p.chronic_condition, p.allergy, p.medication
        FROM accounts a JOIN patient_profiles p ON p.account_id = a.account_id
        WHERE a.account_id = %s
        """,
        (account_id,),
    )
    if not row:
        return None
    country = v.COUNTRIES.get(row["phone_country"], v.COUNTRIES["SA"])
    phone = row["phone"] or ""
    local = phone[len(country["code"]):] if phone.startswith(country["code"]) else phone
    number = lambda value: (int(value) if value == int(value) else float(value)) if value is not None else ""
    return {
        "fullName": row["full_name"],
        "email": row["email"],
        "phoneCountry": row["phone_country"],
        "phoneCode": country["code"],  # e.g. "+966", shown in front of the number
        "phone": local,                # the number without the country code
        "dob": row["dob"],
        "sex": row["sex"],
        "weight": number(row["weight_kg"]),
        "height": number(row["height_cm"]),
        "condition": row["chronic_condition"] or "",
        "allergy": row["allergy"] or "",
        "medication": row["medication"] or "",
    }


@bp.get("/profile")
@role_required("patient")
def get_profile(user):
    profile = profile_json(user["account_id"])
    if not profile:
        return error("Profile not found.", 404)
    return jsonify({"profile": profile})


@bp.put("/profile")
@role_required("patient")
def save_profile(user):
    data = request.get_json(silent=True) or {}
    country = str(data.get("phoneCountry") or "SA")

    weight, weight_problem = v.optional_number(data.get("weight"), 1, 350, "weight (kg)")
    height, height_problem = v.optional_number(data.get("height"), 30, 250, "height (cm)")
    texts = {key: str(data.get(key) or "").strip() for key in ("condition", "allergy", "medication")}
    too_long = lambda key: f"Please keep this under {MAX_TEXT} characters." if len(texts[key]) > MAX_TEXT else ""

    # Same checks as registration.
    problem = v.first_problem([
        ("fullName", v.check_name(data.get("fullName"))),
        ("dob", v.check_dob(data.get("dob"))),
        ("sex", "" if data.get("sex") in ("Female", "Male") else "Please choose your sex."),
        ("weight", weight_problem),
        ("height", height_problem),
        ("phone", v.check_phone(country, data.get("phone"))),
        ("condition", too_long("condition")),
        ("allergy", too_long("allergy")),
        ("medication", too_long("medication")),
    ])
    if problem:
        return error(problem["message"], field=problem["field"])

    execute(
        "UPDATE accounts SET full_name = %s, phone_country = %s, phone = %s, updated_at = NOW() WHERE account_id = %s",
        (data["fullName"].strip(), country, v.full_phone(country, data["phone"]), user["account_id"]),
    )
    execute(
        """
        UPDATE patient_profiles
        SET date_of_birth = %s, sex = %s, weight_kg = %s, height_cm = %s,
            chronic_condition = %s, allergy = %s, medication = %s
        WHERE account_id = %s
        """,
        (data["dob"], data["sex"], weight, height,
         texts["condition"] or None, texts["allergy"] or None, texts["medication"] or None,
         user["account_id"]),
    )
    commit()
    # The new name goes back too, so the top bar can show it.
    return jsonify({"profile": profile_json(user["account_id"]), "user": public_user(current_user())})