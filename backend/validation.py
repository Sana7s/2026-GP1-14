"""
BurnCare — validation.py
-----------------------------------------------------------------------
Checks the data sent by the React forms. These are the SAME rules as the
React pages (RegisterPages.jsx and GuestPage.jsx). The browser checks
them first for a friendly message, but the server must check again,
because anyone can send data to the API without using our pages.

Each check returns a problem message, or "" when the value is fine.
"""

import re
from datetime import date

# ---------------------------------------------------------------------
# Phone numbers (same list as COUNTRIES in RegisterPages.jsx)
#   length → digits AFTER the country code, starts → allowed first digits
# ---------------------------------------------------------------------
COUNTRIES = {
    "SA": {"name": "Saudi Arabia", "code": "+966", "length": 9, "starts": "5"},
    "AE": {"name": "United Arab Emirates", "code": "+971", "length": 9, "starts": "5"},
    "KW": {"name": "Kuwait", "code": "+965", "length": 8, "starts": "569"},
    "BH": {"name": "Bahrain", "code": "+973", "length": 8, "starts": "36"},
    "QA": {"name": "Qatar", "code": "+974", "length": 8, "starts": "3567"},
    "OM": {"name": "Oman", "code": "+968", "length": 8, "starts": "79"},
    "JO": {"name": "Jordan", "code": "+962", "length": 9, "starts": "7"},
    "EG": {"name": "Egypt", "code": "+20", "length": 10, "starts": "1"},
}

# Staff roles: the text shown in the form → the short code saved in the database.
STAFF_ROLES = {
    "Doctor": "doctor",
    "Nurse": "nurse",
    "EMS staff (paramedic)": "ems",
    "Burn specialist": "burn_specialist",
    "Other": "other",
}
# The opposite direction (database code → text), used when sending data back.
STAFF_ROLE_LABELS = {code: label for label, code in STAFF_ROLES.items()}


def clean_phone(typed):
    """Remove spaces, dashes and brackets from a typed phone number."""
    return re.sub(r"[\s\-()]", "", str(typed or ""))


def check_phone(country_id, typed):
    country = COUNTRIES.get(country_id)
    if not country:
        return "Please choose a country from the list."
    raw = clean_phone(typed)
    if not raw:
        return "Please enter your phone number."
    if raw.startswith("+") or raw.startswith("00"):
        return "Don't type the country code. Choose your country, then type the rest of the number."
    if not raw.isdigit():
        return "The phone number can only contain digits."
    if raw.startswith("0"):
        return f"Don't start with 0. Type the number that comes after {country['code']}."
    if len(raw) != country["length"] or raw[0] not in country["starts"]:
        return f"Enter a valid {country['name']} mobile number."
    return ""


def full_phone(country_id, typed):
    """The phone number with its country code, e.g. +966512345678."""
    return COUNTRIES[country_id]["code"] + clean_phone(typed)


def check_name(name):
    name = str(name or "").strip()
    if not name:
        return "Please enter your full name."
    if len(name) < 3:
        return "Your name looks too short."
    if len(name) > 120:
        return "Your name is too long."
    return ""


def check_email(email):
    email = str(email or "").strip()
    if not email:
        return "Please enter your email."
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email) or len(email) > 255:
        return "Enter a valid email, e.g. name@example.com."
    return ""


def check_password(password):
    password = str(password or "")
    if not password:
        return "Please create a password."
    if len(password) < 8 or not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        return "Use at least 8 characters, with at least one letter and one number."
    return ""


def check_scfhs(number):
    number = str(number or "").strip()
    if not number:
        return "Please enter your SCFHS registration number."
    if not re.fullmatch(r"[A-Za-z0-9-]{5,20}", number):
        return "Enter the number as shown on your SCFHS card (letters, digits and dashes only)."
    return ""


def check_dob(value):
    try:
        born = date.fromisoformat(str(value))
    except ValueError:
        return "Please enter your date of birth."
    if born > date.today():
        return "Your date of birth can't be in the future."
    if born < date(1900, 1, 1):
        return "Please check the year of your date of birth."
    return ""


def optional_number(value, low, high, label):
    """Weight / height: empty is fine; otherwise it must be in range.
    Returns (number or None, problem message)."""
    if value in (None, ""):
        return None, ""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None, f"Enter a {label} between {low} and {high}."
    if not low <= number <= high:
        return None, f"Enter a {label} between {low} and {high}."
    return number, ""


def first_problem(checks):
    """Takes a list of (field, message) and returns the first real problem,
    as {"field": ..., "message": ...}, or None if everything is fine."""
    for field, message in checks:
        if message:
            return {"field": field, "message": message}
    return None
