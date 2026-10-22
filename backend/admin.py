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
"""

from flask import Blueprint, jsonify, request

import validation as v
from auth import error, role_required
from db import commit, execute, query_all, query_one

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

    return jsonify({"requests": requests_list, "staff": staff_list, "log": log})


# =====================================================================
# DECISIONS on a request
# =====================================================================

@bp.post("/requests/<int:staff_id>/approve")
@role_required("admin")
def approve(admin, staff_id):
    staff = get_staff(staff_id)
    if not staff or staff["status"] not in ("pending", "changes_requested"):
        return error("This request is not waiting for a decision.", 404)
    execute(
        "UPDATE staff_profiles SET status = 'approved', reviewed_at = NOW(), reviewed_by = %s WHERE account_id = %s",
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
        return error("This request is not waiting for a decision.", 404)
    execute(
        "UPDATE staff_profiles SET status = 'rejected', reviewed_at = NOW(), reviewed_by = %s WHERE account_id = %s",
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
        return error("This request is not waiting for a decision.", 404)
    execute(
        "UPDATE staff_profiles SET status = 'changes_requested', reviewed_at = NOW(), reviewed_by = %s WHERE account_id = %s",
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
