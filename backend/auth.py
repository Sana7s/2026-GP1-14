"""
BurnCare — auth.py
-----------------------------------------------------------------------
Accounts: register, log in, log out, "who am I", and fixing a staff
request after the admin asks for changes.

How logging in works:
  After a correct email + password, Flask saves the user's id in the
  "session" (a signed cookie in the browser). On later requests,
  current_user() reads that id to know who is asking.

API addresses (all start with /api/auth):
  POST /register        create a patient or staff account
  POST /login           log in (admins then get a code by email)
  POST /verify-code     admins: enter the emailed code to finish logging in
  POST /resend-code     admins: send a new code
  POST /logout          log out
  GET  /me              the logged-in user (or null)
  PUT  /staff-request   staff: fix the fields the admin asked to change
  POST /forgot-password    forgot password: email a 6-digit code
  POST /verify-reset-code  forgot password: check the code → reset token
  POST /reset-password     forgot password: save the new password
  POST /change-password    signed in: change the password (needs the current one)
"""

import hashlib
import secrets
from functools import wraps

import psycopg2
from flask import Blueprint, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

import validation as v
from db import commit, execute, query_one
from mailer import code_email, send_email

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


# =====================================================================
# HELPERS used by every API file
# =====================================================================

def error(message, status=400, field=None):
    """A JSON error reply, e.g. {"error": "...", "field": "email"}."""
    body = {"error": message}
    if field:
        body["field"] = field
    return jsonify(body), status


def current_user():
    """The logged-in user (with staff status if staff), or None."""
    account_id = session.get("account_id")
    if not account_id:
        return None
    return query_one(
        """
        SELECT u.account_id, u.full_name, u.email, u.role, u.is_active,
               s.staff_role, s.staff_role_other, s.scfhs_number, s.status AS staff_status
        FROM accounts u
        LEFT JOIN staff_profiles s ON s.account_id = u.account_id
        WHERE u.account_id = %s
        """,
        (account_id,),
    )


def login_required(view):
    """Put @login_required above a route to allow logged-in accounts only."""
    @wraps(view)
    def wrapped(*args, **kwargs):
        user = current_user()
        if not user or not user["is_active"]:
            return error("Please log in first.", 401)
        return view(user, *args, **kwargs)
    return wrapped


def role_required(*roles):
    """@role_required("admin") → only these roles can use the route.
    Staff must also be APPROVED by the admin."""
    def decorator(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            user = current_user()
            if not user or not user["is_active"]:
                return error("Please log in first.", 401)
            if user["role"] not in roles:
                return error("You do not have permission to do this.", 403)
            if user["role"] == "staff" and user["staff_status"] != "approved":
                return error("Your staff account has not been approved yet.", 403)
            return view(user, *args, **kwargs)
        return wrapped
    return decorator


def public_user(user):
    """The user details that are safe to send to the browser."""
    if not user:
        return None
    data = {
        "id": user["account_id"],
        "fullName": user["full_name"],
        "email": user["email"],
        "role": user["role"],
    }
    if user["role"] == "staff":
        data["staffRole"] = v.STAFF_ROLE_LABELS.get(user["staff_role"])
        data["staffStatus"] = user["staff_status"]
        data["canGiveConsultations"] = (
            user["staff_role"] == "burn_specialist" and user["staff_status"] == "approved"
        )
        # If the admin asked for changes, include what to change.
        if user["staff_status"] == "changes_requested":
            review = query_one(
                """
                SELECT requested_fields, note FROM staff_reviews
                WHERE staff_account_id = %s AND action = 'request_changes'
                ORDER BY created_at DESC LIMIT 1
                """,
                (user["account_id"],),
            )
            data["requestedChanges"] = review["requested_fields"] if review else []
            data["adminNote"] = review["note"] if review else None
    return data


# =====================================================================
# ROUTES
# =====================================================================

@bp.post("/register")
def register():
    """Create an account. Patients send their medical profile too;
    staff send their role and SCFHS number and start as "pending"."""
    data = request.get_json(silent=True) or {}
    role = data.get("role")
    if role not in ("patient", "staff"):
        return error("Choose whether you are a patient or healthcare staff.", field="role")

    country = data.get("phoneCountry", "SA")
    problem = v.first_problem([
        ("fullName", v.check_name(data.get("fullName"))),
        ("phone", v.check_phone(country, data.get("phone"))),
        ("email", v.check_email(data.get("email"))),
        ("password", v.check_password(data.get("password"))),
    ])
    if problem:
        return error(problem["message"], field=problem["field"])

    # Extra checks for each role.
    if role == "staff":
        staff_role = v.STAFF_ROLES.get(data.get("staffRole"))
        role_other = str(data.get("staffRoleOther") or "").strip() or None
        problem = v.first_problem([
            ("staffRole", "" if staff_role else "Please choose your role."),
            ("staffRoleOther", "Please type your role." if staff_role == "other" and not role_other else ""),
            ("scfhsNumber", v.check_scfhs(data.get("scfhsNumber"))),
        ])
    else:
        weight, weight_problem = v.optional_number(data.get("weight"), 1, 350, "weight (kg)")
        height, height_problem = v.optional_number(data.get("height"), 30, 250, "height (cm)")
        problem = v.first_problem([
            ("dob", v.check_dob(data.get("dob"))),
            ("sex", "" if data.get("sex") in ("Female", "Male") else "Please choose your sex."),
            ("weight", weight_problem),
            ("height", height_problem),
            ("consent", "" if data.get("consent") is True else "Please agree to share this information."),
        ])
    if problem:
        return error(problem["message"], field=problem["field"])

    email = data["email"].strip().lower()
    if query_one("SELECT 1 FROM accounts WHERE email = %s", (email,)):
        return error("An account with this email already exists.", 409, field="email")

    # Save the user. The password is stored as a hash, never as plain text.
    try:
        user = query_one(
            """
            INSERT INTO accounts (full_name, email, phone_country, phone, password_hash, role)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING account_id
            """,
            (data["fullName"].strip(), email, country, v.full_phone(country, data["phone"]),
             generate_password_hash(data["password"]), role),
        )
        if role == "staff":
            execute(
                """
                INSERT INTO staff_profiles (account_id, staff_role, staff_role_other, scfhs_number)
                VALUES (%s, %s, %s, %s)
                """,
                (user["account_id"], staff_role, role_other if staff_role == "other" else None,
                 data["scfhsNumber"].strip().upper()),
            )
        else:
            # "Other (not listed)" answers: save the typed text instead.
            def pick(choice, typed):
                if choice == "Other (not listed)":
                    return str(typed or "").strip() or None
                return choice or None

            execute(
                """
                INSERT INTO patient_profiles (account_id, date_of_birth, sex, weight_kg, height_cm,
                    chronic_condition, allergy, medication, consent_given)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, TRUE)
                """,
                (user["account_id"], data["dob"], data["sex"], weight, height,
                 pick(data.get("condition"), data.get("conditionOther")),
                 pick(data.get("allergies"), data.get("allergiesOther")),
                 pick(data.get("medications"), data.get("medicationsOther"))),
            )
        commit()
    except psycopg2.IntegrityError:
        return error("An account with this email already exists.", 409, field="email")

    # Patients are logged in straight away. Staff must wait for the admin.
    if role == "patient":
        session.clear()
        session["account_id"] = user["account_id"]
    return jsonify({"user": public_user(current_user() if role == "patient" else None),
                    "status": "pending" if role == "staff" else "active"}), 201


@bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email") or "").strip().lower()
    password = str(data.get("password") or "")
    if not email or not password:
        return error("Please enter your email and password.")

    row = query_one("SELECT account_id, password_hash, is_active FROM accounts WHERE email = %s", (email,))
    # Same message for "no such email" and "wrong password", so nobody can
    # find out which emails have accounts.
    if not row or not check_password_hash(row["password_hash"], password):
        return error("The email or password is incorrect.", 401)
    if not row["is_active"]:
        return error("This account has been disabled. Please contact BurnCare.", 403)

    session.clear()

    # ADMINS: 2-step login. The password was correct, now we email a
    # one-time code. The admin is NOT logged in until the code is entered.
    role = query_one("SELECT role FROM accounts WHERE account_id = %s", (row["account_id"],))["role"]
    if role == "admin":
        session["pending_admin_id"] = row["account_id"]
        send_login_code(row["account_id"], email)
        return jsonify({"verificationRequired": True, "emailHint": hide_email(email)})

    session["account_id"] = row["account_id"]
    user = current_user()

    # Rejected or suspended staff cannot use BurnCare.
    if user["role"] == "staff" and user["staff_status"] in ("rejected", "suspended"):
        session.clear()
        word = "rejected" if user["staff_status"] == "rejected" else "suspended"
        return error(f"Your staff account was {word}. Please check your email for details.", 403)

    return jsonify({"user": public_user(user)})


# =====================================================================
# ADMIN 2-STEP LOGIN: a 6-digit code sent by email
# =====================================================================

CODE_MINUTES = 10   # a code works for 10 minutes
MAX_ATTEMPTS = 5    # after 5 wrong tries the code stops working


def hide_email(email):
    """sana@example.com → s***@example.com (shown on the page)."""
    name, _, domain = email.partition("@")
    return f"{name[0]}***@{domain}"


def send_login_code(account_id, email):
    """Make a new 6-digit code, save its HASH, and email the code."""
    code = f"{secrets.randbelow(1_000_000):06d}"  # e.g. "048213"
    # Old codes stop working when a new one is sent.
    execute("UPDATE verification_codes SET used_at = NOW() "
            "WHERE account_id = %s AND purpose = 'admin_login' AND used_at IS NULL",
            (account_id,))
    execute(
        """
        INSERT INTO verification_codes (account_id, purpose, code_hash, expires_at)
        VALUES (%s, 'admin_login', %s, NOW() + (%s * INTERVAL '1 minute'))
        """,
        (account_id, generate_password_hash(code), CODE_MINUTES),
    )
    commit()
    text, html = code_email(
        heading="Your admin login code",
        intro="Someone (hopefully you) signed in to a BurnCare admin account. "
              "Enter this code on the sign-in page to finish logging in.",
        code=code,
        minutes=CODE_MINUTES,
        footer_note="If this wasn't you, your password may be known to someone else. "
                    "Please change it as soon as possible.",
    )
    send_email(email, f"{code} is your BurnCare login code", text, html)


@bp.post("/verify-code")
def verify_code():
    account_id = session.get("pending_admin_id")
    if not account_id:
        return error("Please log in again.", 401)
    code = str((request.get_json(silent=True) or {}).get("code") or "").strip()
    if not (code.isdigit() and len(code) == 6):
        return error("Enter the 6-digit code from the email.", field="code")

    row = query_one(
        """
        SELECT code_id, code_hash, attempts, (expires_at < NOW()) AS expired
        FROM verification_codes
        WHERE account_id = %s AND purpose = 'admin_login' AND used_at IS NULL
        ORDER BY created_at DESC LIMIT 1
        """,
        (account_id,),
    )
    if not row or row["expired"]:
        return error("This code has expired. Please ask for a new code.", field="code")
    if row["attempts"] >= MAX_ATTEMPTS:
        return error("Too many wrong tries. Please ask for a new code.", field="code")

    if not check_password_hash(row["code_hash"], code):
        execute("UPDATE verification_codes SET attempts = attempts + 1 WHERE code_id = %s",
                (row["code_id"],))
        commit()
        left = MAX_ATTEMPTS - row["attempts"] - 1
        return error(f"The code is incorrect. {left} tries left.", field="code")

    # Correct: the code is used up, and the admin is now logged in.
    execute("UPDATE verification_codes SET used_at = NOW() WHERE code_id = %s",
            (row["code_id"],))
    commit()
    session.clear()
    session["account_id"] = account_id
    return jsonify({"user": public_user(current_user())})


@bp.post("/resend-code")
def resend_code():
    account_id = session.get("pending_admin_id")
    if not account_id:
        return error("Please log in again.", 401)
    # Wait at least 30 seconds between codes.
    recent = query_one(
        """
        SELECT 1 FROM verification_codes
        WHERE account_id = %s AND purpose = 'admin_login' AND created_at > NOW() - INTERVAL '30 seconds'
        """,
        (account_id,),
    )
    if recent:
        return error("Please wait 30 seconds before asking for a new code.", 429)
    account = query_one("SELECT email FROM accounts WHERE account_id = %s", (account_id,))
    send_login_code(account_id, account["email"])
    return jsonify({"ok": True, "emailHint": hide_email(account["email"])})


@bp.post("/logout")
def logout():
    session.clear()
    return jsonify({"ok": True})


@bp.get("/me")
def me():
    return jsonify({"user": public_user(current_user())})


@bp.put("/staff-request")
@login_required
def update_staff_request(user):
    """Staff fix the fields the admin asked them to change, then the
    request goes back to the admin as "pending"."""
    if user["role"] != "staff" or user["staff_status"] != "changes_requested":
        return error("There is nothing to change on your request.", 400)

    data = request.get_json(silent=True) or {}
    full_name = str(data.get("fullName", user["full_name"])).strip()
    scfhs = str(data.get("scfhsNumber", user["scfhs_number"])).strip().upper()
    staff_role = v.STAFF_ROLES.get(data.get("staffRole")) if "staffRole" in data else user["staff_role"]
    role_other = str(data.get("staffRoleOther") or "").strip() or None

    problem = v.first_problem([
        ("fullName", v.check_name(full_name)),
        ("scfhsNumber", v.check_scfhs(scfhs)),
        ("staffRole", "" if staff_role else "Please choose your role."),
        ("staffRoleOther", "Please type your role." if staff_role == "other" and not role_other else ""),
    ])
    if problem:
        return error(problem["message"], field=problem["field"])

    execute("UPDATE accounts SET full_name = %s WHERE account_id = %s", (full_name, user["account_id"]))
    execute(
        """
        UPDATE staff_profiles
        SET scfhs_number = %s, staff_role = %s, staff_role_other = %s,
            status = 'pending', submitted_at = NOW()
        WHERE account_id = %s
        """,
        (scfhs, staff_role, role_other if staff_role == "other" else None, user["account_id"]),
    )
    commit()
    return jsonify({"user": public_user(current_user())})


# =====================================================================
# FORGOT PASSWORD: email a 6-digit code, then set a new password
# Used by ForgotPasswordPage.jsx (3 steps):
#   POST /forgot-password    {email}                 → always the same reply
#   POST /verify-reset-code  {email, code}           → {reset_token}
#   POST /reset-password     {reset_token, password} → {ok: true}
# =====================================================================

RESET_TOKEN_MINUTES = 15  # time to type the new password after the code
WRONG_RESET_CODE = "That code is incorrect or has expired."


def token_hash(token):
    """The reset token is long and random, so a plain SHA-256 is enough,
    and (unlike a salted hash) it can be looked up in the database."""
    return hashlib.sha256(token.encode()).hexdigest()


@bp.post("/forgot-password")
def forgot_password():
    email = str((request.get_json(silent=True) or {}).get("email") or "").strip().lower()
    problem = v.check_email(email)
    if problem:
        return error(problem, field="email")

    # The SAME reply whether or not the email has an account, so nobody can
    # use this page to find out who is registered.
    reply = jsonify({"ok": True})

    row = query_one("SELECT account_id, is_active FROM accounts WHERE email = %s", (email,))
    if not row or not row["is_active"]:
        return reply
    # At most one email every 30 seconds.
    if query_one(
        """
        SELECT 1 FROM verification_codes
        WHERE account_id = %s AND purpose = 'password_reset' AND created_at > NOW() - INTERVAL '30 seconds'
        """,
        (row["account_id"],),
    ):
        return reply

    code = f"{secrets.randbelow(1_000_000):06d}"
    # Old reset codes stop working when a new one is sent.
    execute("UPDATE verification_codes SET used_at = NOW() "
            "WHERE account_id = %s AND purpose = 'password_reset' AND used_at IS NULL",
            (row["account_id"],))
    execute(
        """
        INSERT INTO verification_codes (account_id, purpose, code_hash, expires_at)
        VALUES (%s, 'password_reset', %s, NOW() + (%s * INTERVAL '1 minute'))
        """,
        (row["account_id"], generate_password_hash(code), CODE_MINUTES),
    )
    commit()
    text, html = code_email(
        heading="Reset your password",
        intro="We received a request to reset the password for your BurnCare account. "
              "Enter this code on the Forgot password page to choose a new one.",
        code=code,
        minutes=CODE_MINUTES,
        footer_note="If you didn't ask to reset your password, you can ignore this email. "
                    "Your password won't change.",
    )
    send_email(email, f"{code} is your BurnCare password reset code", text, html)
    return reply


@bp.post("/verify-reset-code")
def verify_reset_code():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email") or "").strip().lower()
    code = str(data.get("code") or "").strip()
    if not (code.isdigit() and len(code) == 6):
        return error("Enter the 6-digit code from the email.", field="code")

    row = query_one(
        """
        SELECT c.code_id, c.code_hash, c.attempts, (c.expires_at < NOW()) AS expired
        FROM verification_codes c JOIN accounts a ON a.account_id = c.account_id
        WHERE a.email = %s AND c.purpose = 'password_reset' AND c.used_at IS NULL
        ORDER BY c.created_at DESC LIMIT 1
        """,
        (email,),
    )
    if not row or row["expired"] or row["attempts"] >= MAX_ATTEMPTS:
        return error(WRONG_RESET_CODE, field="code")
    if not check_password_hash(row["code_hash"], code):
        execute("UPDATE verification_codes SET attempts = attempts + 1 WHERE code_id = %s",
                (row["code_id"],))
        commit()
        return error(WRONG_RESET_CODE, field="code")

    # Correct code: give the page a one-time token for the last step.
    token = secrets.token_urlsafe(32)
    execute(
        """
        UPDATE verification_codes
        SET verified_at = NOW(), reset_token_hash = %s,
            reset_token_expires_at = NOW() + (%s * INTERVAL '1 minute')
        WHERE code_id = %s
        """,
        (token_hash(token), RESET_TOKEN_MINUTES, row["code_id"]),
    )
    commit()
    return jsonify({"reset_token": token})


@bp.post("/reset-password")
def reset_password():
    data = request.get_json(silent=True) or {}
    token = str(data.get("reset_token") or "")
    password = str(data.get("password") or "")
    problem = v.check_password(password)
    if problem:
        return error(problem, field="password")

    row = query_one(
        """
        SELECT code_id, account_id FROM verification_codes
        WHERE purpose = 'password_reset' AND reset_token_hash = %s
          AND used_at IS NULL AND reset_token_expires_at > NOW()
        """,
        (token_hash(token),),
    ) if token else None
    if not row:
        return error("This reset session has expired. Please request a new code.")

    execute("UPDATE accounts SET password_hash = %s WHERE account_id = %s",
            (generate_password_hash(password), row["account_id"]))
    execute("UPDATE verification_codes SET used_at = NOW() WHERE code_id = %s", (row["code_id"],))
    commit()
    return jsonify({"ok": True})


# =====================================================================
# CHANGE PASSWORD (signed in, from the Profile page)
#   POST /change-password  {currentPassword, newPassword} → {ok: true}
# =====================================================================

@bp.post("/change-password")
@login_required
def change_password(user):
    data = request.get_json(silent=True) or {}
    current = str(data.get("currentPassword") or "")
    new = str(data.get("newPassword") or "")

    if not current:
        return error("Please enter your current password.", field="currentPassword")
    problem = v.check_password(new)
    if problem:
        return error(problem, field="newPassword")

    row = query_one("SELECT password_hash FROM accounts WHERE account_id = %s", (user["account_id"],))
    # The current password must be right, so someone using an unlocked
    # computer can't change it.
    if not check_password_hash(row["password_hash"], current):
        return error("Your current password is incorrect.", field="currentPassword")
    if check_password_hash(row["password_hash"], new):
        return error("Choose a password that is different from your current one.", field="newPassword")

    execute("UPDATE accounts SET password_hash = %s, updated_at = NOW() WHERE account_id = %s",
            (generate_password_hash(new), user["account_id"]))
    # Any open "forgot password" code stops working.
    execute("UPDATE verification_codes SET used_at = NOW() "
            "WHERE account_id = %s AND purpose = 'password_reset' AND used_at IS NULL",
            (user["account_id"],))
    commit()

    # Tell the owner, in case it wasn't them. The password is already
    # changed, so a problem sending the email doesn't undo it.
    try:
        send_email(
            user["email"],
            "Your BurnCare password was changed",
            "The password for your BurnCare account was just changed.\n\n"
            "If this was you, you don't need to do anything.\n"
            "If it wasn't you, reset your password now with \"Forgot password?\" on the sign-in page.\n\n"
            "— BurnCare\nThis is an automatic email. Replies to it are not read.",
        )
    except Exception:  # noqa: BLE001 — the change itself already worked
        pass
    return jsonify({"ok": True})