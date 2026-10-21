"""
BurnCare — consultations.py
-----------------------------------------------------------------------
Approved staff ask a burn specialist about a case; burn specialists
answer. (The Consultations page itself will be built later; these
addresses are ready for it.)

API addresses (all start with /api/consultations):
  POST /                      staff: ask about one of the assessments
  GET  /                      staff: my questions | specialist: open + mine
  GET  /<id>                  one consultation with its messages
  POST /<id>/messages         add a message (asker or the specialist)
  POST /<id>/close            close the consultation
"""

from flask import Blueprint, jsonify, request

from auth import error, role_required
from db import commit, execute, query_all, query_one

bp = Blueprint("consultations", __name__, url_prefix="/api/consultations")


def is_specialist(user):
    return user["role"] == "staff" and user["staff_role"] == "burn_specialist"


def can_see(user, row):
    """The asker, the specialist on the case, or any specialist while it is open."""
    return (
        row["requested_by"] == user["account_id"]
        or row["specialist_id"] == user["account_id"]
        or (is_specialist(user) and row["status"] == "open" and row["specialist_id"] is None)
    )


@bp.post("")
@role_required("staff")
def create(user):
    data = request.get_json(silent=True) or {}
    question = str(data.get("question") or "").strip()
    code = str(data.get("reportCode") or "").strip().upper()
    if not question:
        return error("Please write your question.", field="question")
    assessment = query_one("SELECT assessment_id FROM assessments WHERE report_code = %s", (code,))
    if not assessment:
        return error("Report not found.", 404, field="reportCode")

    row = query_one(
        """
        INSERT INTO consultations (assessment_id, requested_by, question)
        VALUES (%s, %s, %s) RETURNING consultation_id
        """,
        (assessment["assessment_id"], user["account_id"], question),
    )
    commit()
    return jsonify({"id": row["consultation_id"]}), 201


@bp.get("")
@role_required("staff")
def list_consultations(user):
    rows = query_all(
        """
        SELECT c.consultation_id, c.question, c.status, c.requested_by, c.specialist_id,
               a.report_code, u.full_name AS asked_by,
               TO_CHAR(c.created_at, 'FMDD Mon YYYY, HH24:MI') AS created
        FROM consultations c
        JOIN assessments a ON a.assessment_id = c.assessment_id
        JOIN accounts u ON u.account_id = c.requested_by
        WHERE c.requested_by = %s
           OR c.specialist_id = %s
           OR (%s AND c.status = 'open' AND c.specialist_id IS NULL)
        ORDER BY c.created_at DESC
        """,
        (user["account_id"], user["account_id"], is_specialist(user)),
    )
    return jsonify({"consultations": [{
        "id": r["consultation_id"],
        "question": r["question"],
        "status": r["status"],
        "reportCode": r["report_code"],
        "askedBy": r["asked_by"],
        "createdAt": r["created"],
    } for r in rows]})


@bp.get("/<int:consultation_id>")
@role_required("staff")
def get_one(user, consultation_id):
    row = query_one("SELECT * FROM consultations WHERE consultation_id = %s", (consultation_id,))
    if not row or not can_see(user, row):
        return error("Consultation not found.", 404)
    messages = query_all(
        """
        SELECT m.message_no, m.message_text, u.full_name,
               TO_CHAR(m.sent_at, 'FMDD Mon YYYY, HH24:MI') AS sent
        FROM consultation_messages m JOIN accounts u ON u.account_id = m.sender_id
        WHERE m.consultation_id = %s ORDER BY m.message_no
        """,
        (consultation_id,),
    )
    return jsonify({
        "id": row["consultation_id"],
        "question": row["question"],
        "status": row["status"],
        "messages": [{"id": m["message_no"], "text": m["message_text"],
                      "from": m["full_name"], "sentAt": m["sent"]} for m in messages],
    })


@bp.post("/<int:consultation_id>/messages")
@role_required("staff")
def add_message(user, consultation_id):
    row = query_one("SELECT * FROM consultations WHERE consultation_id = %s", (consultation_id,))
    if not row or not can_see(user, row):
        return error("Consultation not found.", 404)
    if row["status"] == "closed":
        return error("This consultation is closed.")
    text = str((request.get_json(silent=True) or {}).get("text") or "").strip()
    if not text:
        return error("Please write a message.", field="text")

    # The first specialist to reply takes the case and it becomes "answered".
    if is_specialist(user) and row["requested_by"] != user["account_id"]:
        execute(
            """
            UPDATE consultations
            SET specialist_id = COALESCE(specialist_id, %s), status = 'answered',
                answered_at = COALESCE(answered_at, NOW())
            WHERE consultation_id = %s
            """,
            (user["account_id"], consultation_id),
        )
    # Messages are numbered 1, 2, 3 ... inside each consultation (weak entity).
    execute(
        """
        INSERT INTO consultation_messages (consultation_id, message_no, sender_id, message_text)
        VALUES (%s, (SELECT COALESCE(MAX(message_no), 0) + 1 FROM consultation_messages
                     WHERE consultation_id = %s), %s, %s)
        """,
        (consultation_id, consultation_id, user["account_id"], text),
    )
    commit()
    return jsonify({"ok": True}), 201


@bp.post("/<int:consultation_id>/close")
@role_required("staff")
def close(user, consultation_id):
    row = query_one("SELECT * FROM consultations WHERE consultation_id = %s", (consultation_id,))
    if not row or user["account_id"] not in (row["requested_by"], row["specialist_id"]):
        return error("Consultation not found.", 404)
    execute("UPDATE consultations SET status = 'closed' WHERE consultation_id = %s", (consultation_id,))
    commit()
    return jsonify({"ok": True})
