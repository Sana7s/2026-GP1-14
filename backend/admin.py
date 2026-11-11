"""
BurnCare 
-----------------------------------------------------------------------
Everything the Admin page needs. Only accounts with role = 'admin' can use
these addresses (see @role_required("admin")).

API addresses (all start with /api/admin):
  GET  /overview                     requests + staff + log, in one call
  POST /requests/<id>/approve        approve a staff request
  POST /requests/<id>/reject         reject (needs a reason)
  POST /requests/<id>/request-changes  ask the person to change fields
  POST /staff/<id>/suspend           remove an approved person's access
  POST /staff/<id>/reactivate        give access back

  Several admins (super admins only):
  GET  /admins                       all admins
  POST /admins                       add (invite) a new admin
  POST /admins/<id>/deactivate       stop an admin from logging in
  POST /admins/<id>/reactivate       let them log in again

Two admin levels (admin_profiles.admin_level):
  super  reviews staff requests AND adds / deactivates admins
  admin  reviews staff requests only
All admins share the same request list. If two admins open the same
request, the first decision wins; the second admin is told who decided.
Safety rules: an admin cannot deactivate themself, and there is always
at least one active super admin.
"""

import secrets

from flask import Blueprint, jsonify, request

from werkzeug.security import generate_password_hash

import validation as v
from auth import error, role_required
from db import commit, execute, query_all, query_one
from mailer import notice_email, send_email

bp = Blueprint("admin", __name__, url_prefix="/api/admin")

# The fields an admin can ask staff to change (same as CORRECTIONS in AdminPage.jsx).
CHANGE_FIELDS = {"scfhs": "SCFHS number", "name": "Full name", "role": "Role"}

REJECT_REASONS = ["SCFHS number not found", "Name does not match", "Role does not match",
                  "Duplicate account", "Other"]


def role_label(row):
    """'burn_specialist' → 'Burn specialist'; 'other' → 'Other: Pharmacist'."""
    if row["staff_role"] == "other" and row.get("staff_role_other"):
        return f"Other: {row['staff_role_other']}"
    return v.STAFF_ROLE_LABELS.get(row["staff_role"], row["staff_role"])


def add_review(staff_id, admin_id, action, reason=None, fields=None, note=None):
    """Save one admin decision in staff_reviews (the activity log)."""
    execute(
        """
        INSERT INTO staff_reviews (staff_account_id, admin_id, action, reason, requested_fields, note)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (staff_id, admin_id, action, reason, fields, note),
    )


ACTION_WORDS = {"approve": "approved", "reject": "rejected", "request_changes": "sent back for changes"}


def already_decided(staff, staff_id):
    """The reply when a request is no longer waiting, e.g. another admin
    decided it a moment ago: 'This request was already approved by Sara.'"""
    if not staff:
        return error("This request was not found.", 404)
    last = query_one(
        """
        SELECT r.action, a.full_name FROM staff_reviews r
        LEFT JOIN accounts a ON a.account_id = r.admin_id
        WHERE r.staff_account_id = %s ORDER BY r.created_at DESC LIMIT 1
        """,
        (staff_id,),
    )
    if last and last["action"] in ACTION_WORDS:
        by = f" by {last['full_name']}" if last["full_name"] else ""
        return error(f"This request was already {ACTION_WORDS[last['action']]}{by}.", 409)
    return error("This request is not waiting for a decision.", 409)


def get_staff(staff_id):
    return query_one(
        """
        SELECT u.account_id, u.full_name, s.staff_role, s.staff_role_other, s.status
        FROM staff_profiles s JOIN accounts u ON u.account_id = s.account_id
        WHERE s.account_id = %s
        """,
        (staff_id,),
    )


# =====================================================================
# READ: everything the page shows
# =====================================================================

@bp.get("/overview")
@role_required("admin")
def overview(admin):
    # 1) Requests waiting for a decision (pending, or waiting for changes).
    rows = query_all(
        """
        SELECT u.account_id, u.full_name, u.email, u.phone,
               s.staff_role, s.staff_role_other, s.scfhs_number, s.status,
               FLOOR(EXTRACT(EPOCH FROM (NOW() - s.submitted_at)) / 3600)::int AS hours_waiting,
               r.requested_fields, r.note
        FROM staff_profiles s
        JOIN accounts u ON u.account_id = s.account_id
        -- the latest "request changes" decision, if there is one
        LEFT JOIN LATERAL (
            SELECT requested_fields, note FROM staff_reviews
            WHERE staff_account_id = s.account_id AND action = 'request_changes'
            ORDER BY created_at DESC LIMIT 1
        ) r ON s.status = 'changes_requested'
        WHERE s.status IN ('pending', 'changes_requested')
        ORDER BY s.submitted_at
        """
    )
    requests_list = [{
        "id": row["account_id"],
        "name": row["full_name"],
        "role": role_label(row),
        "scfhs": row["scfhs_number"],
        "phone": row["phone"],
        "email": row["email"],
        "hoursWaiting": row["hours_waiting"],
        "corrections": [CHANGE_FIELDS.get(f, f) for f in row["requested_fields"]] if row["requested_fields"] else None,
        "correctionNote": row["note"],
    } for row in rows]

    # 2) Approved and suspended staff.
    rows = query_all(
        """
        SELECT u.account_id, u.full_name, s.staff_role, s.staff_role_other, s.scfhs_number, s.status,
               TO_CHAR(s.reviewed_at, 'FMDD Mon YYYY') AS approved
        FROM staff_profiles s JOIN accounts u ON u.account_id = s.account_id
        WHERE s.status IN ('approved', 'suspended')
        ORDER BY s.reviewed_at DESC NULLS LAST
        """
    )
    staff_list = [{
        "id": row["account_id"],
        "name": row["full_name"],
        "role": role_label(row),
        "scfhs": row["scfhs_number"],
        "status": "Active" if row["status"] == "approved" else "Suspended",
        "approved": row["approved"] or "",
    } for row in rows]

    # 3) The activity log (newest first).
    rows = query_all(
        """
        SELECT r.review_id, r.action, r.reason, r.requested_fields, r.note,
               TO_CHAR(r.created_at, 'FMDD Mon YYYY, HH24:MI') AS created,
               u.full_name, s.staff_role, s.staff_role_other, a.full_name AS admin_name
        FROM staff_reviews r
        JOIN staff_profiles s ON s.account_id = r.staff_account_id
        JOIN accounts u ON u.account_id = r.staff_account_id
        LEFT JOIN accounts a ON a.account_id = r.admin_id
        ORDER BY r.created_at DESC
        LIMIT 100
        """
    )
    log = []
    for row in rows:
        who = f"{row['full_name']} ({role_label(row)})"
        if row["action"] == "approve":
            text, kind = f"Approved {who}", "approve"
        elif row["action"] == "reject":
            text, kind = f"Rejected {who} — {row['note'] or row['reason']}", "reject"
        elif row["action"] == "request_changes":
            fields = ", ".join(CHANGE_FIELDS.get(f, f) for f in (row["requested_fields"] or []))
            text, kind = f"Requested changes from {row['full_name']}: {fields}", "info"
        elif row["action"] == "suspend":
            text, kind = f"Suspended {row['full_name']}", "suspend"
        else:
            text, kind = f"Reactivated {row['full_name']}", "approve"
        if row["admin_name"]:
            text += f" · by {row['admin_name']}"
        log.append({"id": row["review_id"], "text": text, "when": row["created"], "type": kind})

    return jsonify({"requests": requests_list, "staff": staff_list, "log": log,
                    "me": {"id": admin["account_id"], "level": admin.get("admin_level") or "admin"}})


# =====================================================================
# DECISIONS on a request
# =====================================================================

@bp.post("/requests/<int:staff_id>/approve")
@role_required("admin")
def approve(admin, staff_id):
    staff = get_staff(staff_id)
    if not staff or staff["status"] not in ("pending", "changes_requested"):
        return already_decided(staff, staff_id)
    execute(
        "UPDATE staff_profiles SET status = 'approved', reviewed_at = NOW(), reviewed_by = %s "
        "WHERE account_id = %s AND status IN ('pending', 'changes_requested')",
        (admin["account_id"], staff_id),
    )
    add_review(staff_id, admin["account_id"], "approve")
    commit()
    # TODO: email the person that they can now log in.
    return jsonify({"ok": True})


@bp.post("/requests/<int:staff_id>/reject")
@role_required("admin")
def reject(admin, staff_id):
    data = request.get_json(silent=True) or {}
    reason = data.get("reason")
    note = str(data.get("note") or "").strip() or None
    if reason not in REJECT_REASONS:
        return error("Please choose a reason.", field="reason")
    if reason == "Other" and not note:
        return error("Please type the reason.", field="note")

    staff = get_staff(staff_id)
    if not staff or staff["status"] not in ("pending", "changes_requested"):
        return already_decided(staff, staff_id)
    execute(
        "UPDATE staff_profiles SET status = 'rejected', reviewed_at = NOW(), reviewed_by = %s "
        "WHERE account_id = %s AND status IN ('pending', 'changes_requested')",
        (admin["account_id"], staff_id),
    )
    add_review(staff_id, admin["account_id"], "reject", reason=reason, note=note)
    commit()
    # TODO: email the person the reason.
    return jsonify({"ok": True})


@bp.post("/requests/<int:staff_id>/request-changes")
@role_required("admin")
def request_changes(admin, staff_id):
    data = request.get_json(silent=True) or {}
    fields = data.get("fields") or []
    note = str(data.get("note") or "").strip() or None
    if not isinstance(fields, list) or not fields or any(f not in CHANGE_FIELDS for f in fields):
        return error("Choose at least one field to change.", field="fields")

    staff = get_staff(staff_id)
    if not staff or staff["status"] not in ("pending", "changes_requested"):
        return already_decided(staff, staff_id)
    execute(
        "UPDATE staff_profiles SET status = 'changes_requested', reviewed_at = NOW(), reviewed_by = %s "
        "WHERE account_id = %s AND status IN ('pending', 'changes_requested')",
        (admin["account_id"], staff_id),
    )
    add_review(staff_id, admin["account_id"], "request_changes", fields=fields, note=note)
    commit()
    # TODO: email the person what to change.
    return jsonify({"ok": True})


# =====================================================================
# APPROVED STAFF: suspend or reactivate
# =====================================================================

@bp.post("/staff/<int:staff_id>/suspend")
@role_required("admin")
def suspend(admin, staff_id):
    staff = get_staff(staff_id)
    if not staff or staff["status"] != "approved":
        return error("Only active staff can be suspended.", 404)
    execute("UPDATE staff_profiles SET status = 'suspended' WHERE account_id = %s", (staff_id,))
    add_review(staff_id, admin["account_id"], "suspend")
    commit()
    return jsonify({"ok": True})


@bp.post("/staff/<int:staff_id>/reactivate")
@role_required("admin")
def reactivate(admin, staff_id):
    staff = get_staff(staff_id)
    if not staff or staff["status"] != "suspended":
        return error("Only suspended staff can be reactivated.", 404)
    execute("UPDATE staff_profiles SET status = 'approved' WHERE account_id = %s", (staff_id,))
    add_review(staff_id, admin["account_id"], "reactivate")
    commit()
    return jsonify({"ok": True})


# =====================================================================
# SEVERAL ADMINS: list, add (invite), deactivate, reactivate
# Only SUPER admins can use these.
# =====================================================================

def super_only(admin):
    """None if this admin is a super admin, else the error reply."""
    if (admin.get("admin_level") or "admin") != "super":
        return error("Only a super admin can manage admins.", 403)
    return None


def get_admin(account_id):
    return query_one(
        """
        SELECT u.account_id, u.full_name, u.email, u.is_active, p.admin_level
        FROM admin_profiles p JOIN accounts u ON u.account_id = p.account_id
        WHERE p.account_id = %s
        """,
        (account_id,),
    )


@bp.get("/admins")
@role_required("admin")
def list_admins(admin):
    problem = super_only(admin)
    if problem:
        return problem
    rows = query_all(
        """
        SELECT u.account_id, u.full_name, u.email, u.phone, u.is_active, p.job_title, p.admin_level,
               TO_CHAR(u.created_at, 'FMDD Mon YYYY') AS added, c.full_name AS added_by
        FROM admin_profiles p
        JOIN accounts u ON u.account_id = p.account_id
        LEFT JOIN accounts c ON c.account_id = p.created_by
        ORDER BY u.is_active DESC, (p.admin_level = 'super') DESC, u.full_name
        """
    )
    return jsonify({"admins": [{
        "id": r["account_id"],
        "name": r["full_name"],
        "email": r["email"],
        "phone": r["phone"],
        "jobTitle": r["job_title"],
        "level": r["admin_level"],
        "status": "Active" if r["is_active"] else "Deactivated",
        "added": r["added"] or "",
        "addedBy": r["added_by"] or "",
        "isMe": r["account_id"] == admin["account_id"],
    } for r in rows]})


@bp.post("/admins")
@role_required("admin")
def add_admin(admin):
    """Invite a new admin. The account is made with a random password that
    nobody knows; the new admin sets their own password with the
    "Forgot password" page (the invitation email explains how)."""
    problem = super_only(admin)
    if problem:
        return problem
    data = request.get_json(silent=True) or {}
    name = str(data.get("fullName") or "").strip()
    email = str(data.get("email") or "").strip().lower()
    phone = str(data.get("phone") or "").strip()
    job_title = str(data.get("jobTitle") or "").strip()
    level = data.get("level") or "admin"

    problem = v.first_problem([
        ("fullName", v.check_name(name)),
        ("email", v.check_email(email)),
        ("phone", v.check_phone("SA", phone)),
        ("jobTitle", "" if job_title else "Please enter the job title."),
        ("jobTitle", "The job title can be up to 60 characters." if len(job_title) > 60 else ""),
        ("level", "" if level in ("super", "admin") else "Please choose the admin level."),
    ])
    if problem:
        return error(problem["message"], field=problem["field"])
    if query_one("SELECT 1 FROM accounts WHERE email = %s", (email,)):
        return error("An account with this email already exists.", 409, field="email")

    row = query_one(
        """
        INSERT INTO accounts (full_name, email, phone_country, phone, password_hash, role)
        VALUES (%s, %s, 'SA', %s, %s, 'admin') RETURNING account_id
        """,
        (name, email, v.full_phone("SA", phone), generate_password_hash(secrets.token_urlsafe(32))),
    )
    execute(
        "INSERT INTO admin_profiles (account_id, job_title, admin_level, created_by) VALUES (%s, %s, %s, %s)",
        (row["account_id"], job_title, level, admin["account_id"]),
    )
    commit()

    level_text = "a super admin" if level == "super" else "an admin"
    text, html = notice_email(
        heading="You have been added as a BurnCare admin",
        paragraphs=[
            f"{admin['full_name']} has added you as {level_text} on BurnCare. "
            "Admins review the healthcare staff who register on BurnCare before they can use it.",
            "To set your password: open the BurnCare Log in page, choose \"Forgot password\", "
            f"and enter this email address ({email}). You will receive a code to choose your password.",
            "Each time you log in, BurnCare will also email you a 6-digit code to confirm it is you.",
        ],
        footer_note="If you did not expect this email, please contact the BurnCare team.",
    )
    send_email(email, "You have been added as a BurnCare admin", text, html)
    return jsonify({"ok": True, "id": row["account_id"]}), 201


@bp.post("/admins/<int:admin_id>/deactivate")
@role_required("admin")
def deactivate_admin(admin, admin_id):
    problem = super_only(admin)
    if problem:
        return problem
    if admin_id == admin["account_id"]:
        return error("You cannot deactivate your own account.", 400)
    target = get_admin(admin_id)
    if not target:
        return error("Admin not found.", 404)
    if not target["is_active"]:
        return error("This admin is already deactivated.", 409)
    if target["admin_level"] == "super":
        others = query_one(
            """
            SELECT COUNT(*) AS n FROM admin_profiles p JOIN accounts u ON u.account_id = p.account_id
            WHERE p.admin_level = 'super' AND u.is_active AND p.account_id <> %s
            """,
            (admin_id,),
        )
        if not others or others["n"] < 1:
            return error("BurnCare must always have at least one active super admin.", 400)
    # is_active = FALSE: they cannot log in, and any open session stops
    # working at once (every admin request checks is_active).
    execute("UPDATE accounts SET is_active = FALSE, updated_at = NOW() WHERE account_id = %s", (admin_id,))
    commit()
    return jsonify({"ok": True})


@bp.post("/admins/<int:admin_id>/reactivate")
@role_required("admin")
def reactivate_admin(admin, admin_id):
    problem = super_only(admin)
    if problem:
        return problem
    target = get_admin(admin_id)
    if not target:
        return error("Admin not found.", 404)
    if target["is_active"]:
        return error("This admin is already active.", 409)
    execute("UPDATE accounts SET is_active = TRUE, updated_at = NOW() WHERE account_id = %s", (admin_id,))
    commit()
    return jsonify({"ok": True})
