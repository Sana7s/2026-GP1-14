"""
BurnCare — consultations.py
-----------------------------------------------------------------------
Approved staff ask a burn specialist about a case; burn specialists
answer. Supports multi-specialist replies and physician-selected routing.

API addresses (all start with /api/consultations):
  GET  /specialists         get list of available burn specialists
  POST /                    staff: ask a specialist about an assessment
  GET  /                    staff: my questions | specialist: open + mine
  GET  /<id>                one consultation with its messages
  POST /<id>/messages       add a message (asker or any specialist)
  POST /<id>/close          close the consultation

Emails (mailer.py): a new question is emailed to the chosen specialist,
or to all approved burn specialists; a specialist's reply is emailed to
the staff member who asked. The emails never contain the question or
any patient detail, only a reminder to sign in. If an email fails, the
consultation still works.
"""

from flask import Blueprint, jsonify, request

from auth import error, role_required
from db import commit, execute, query_all, query_one
from mailer import notice_email, send_email

bp = Blueprint("consultations", __name__, url_prefix="/api/consultations")


def is_specialist(user):
    return user["role"] == "staff" and user["staff_role"] == "burn_specialist"


def can_see(user, row):
    """The asker, the targeted specialist, or any specialist while it is open."""
    return (
        row["requested_by"] == user["account_id"]
        or row["specialist_id"] == user["account_id"]
        or (is_specialist(user) and row["status"] != "closed" and (row["specialist_id"] is None or row["specialist_id"] == user["account_id"]))
    )


def _notify(addresses, heading, paragraphs):
    """Email each address. A failed email must never stop the consultation."""
    for address in addresses:
        try:
            text, html = notice_email(heading, paragraphs, "Sign in to BurnCare to open the consultation.")
            send_email(address, heading, text, html)
        except Exception as problem:  # the consultation is already saved
            print(f"Consultation email to {address} failed:", problem)


@bp.get("/specialists")
@role_required("staff")
def list_specialists(user):
    """Return a list of approved burn specialists so staff can choose one."""
    rows = query_all(
        """
        SELECT account_id, full_name, email
        FROM accounts
        WHERE role = 'staff' AND staff_role = 'burn_specialist' AND is_approved = TRUE
        ORDER BY full_name
        """
    )
    return jsonify({"specialists": [{"id": r["account_id"], "fullName": r["full_name"], "email": r["email"]} for r in rows]})


@bp.post("")
@role_required("staff")
def create(user):
    data = request.get_json(silent=True) or {}
    question = str(data.get("question") or "").strip()
    code = str(data.get("reportCode") or "").strip().upper()
    specialist_id = data.get("specialistId")

    if not question:
        return error("Please write your question.", field="question")

    assessment = query_one("SELECT assessment_id FROM assessments WHERE report_code = %s", (code,))
    if not assessment:
        return error("Report not found.", 404, field="reportCode")

    row = query_one(
        """
        INSERT INTO consultations (assessment_id, requested_by, specialist_id, question)
        VALUES (%s, %s, %s, %s) RETURNING consultation_id
        """,
        (assessment["assessment_id"], user["account_id"], specialist_id if specialist_id else None, question),
    )
    commit()

    # Email the chosen specialist, or every approved burn specialist.
    try:
        if specialist_id:
            people = query_all(
                """
                SELECT email FROM accounts
                WHERE account_id = %s AND staff_role = 'burn_specialist' AND is_approved = TRUE
                """,
                (specialist_id,),
            )
        else:
            people = query_all(
                """
                SELECT email FROM accounts
                WHERE role = 'staff' AND staff_role = 'burn_specialist' AND is_approved = TRUE
                  AND account_id <> %s
                """,
                (user["account_id"],),
            )
        _notify(
            [p["email"] for p in people],
            "New consultation question",
            [f"A healthcare staff member asked a question about report {code}.",
             "Sign in to BurnCare to read it and reply."],
        )
    except Exception as problem:
        print("Could not email the specialists:", problem)

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
           OR (%s AND c.status <> 'closed' AND (c.specialist_id IS NULL OR c.specialist_id = %s))
        ORDER BY c.created_at DESC
        """,
        (user["account_id"], user["account_id"], is_specialist(user), user["account_id"]),
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

    # A specialist (not the asker) is replying.
    specialist_replied = is_specialist(user) and row["requested_by"] != user["account_id"]

    # Multi-specialist update: Change status to 'answered' when a specialist replies,
    # but do NOT lock it to a single specialist so others can also reply.
    if specialist_replied:
        execute(
            """
            UPDATE consultations
            SET status = 'answered',
                answered_at = COALESCE(answered_at, NOW())
            WHERE consultation_id = %s
            """,
            (consultation_id,),
        )

    execute(
        """
        INSERT INTO consultation_messages (consultation_id, message_no, sender_id, message_text)
        VALUES (%s, (SELECT COALESCE(MAX(message_no), 0) + 1 FROM consultation_messages
                     WHERE consultation_id = %s), %s, %s)
        """,
        (consultation_id, consultation_id, user["account_id"], text),
    )
    commit()

    # Tell the staff member who asked that a specialist replied.
    if specialist_replied:
        try:
            asker = query_one("SELECT email FROM accounts WHERE account_id = %s", (row["requested_by"],))
            if asker:
                _notify(
                    [asker["email"]],
                    "A burn specialist replied",
                    ["A burn specialist replied to your consultation question.",
                     "Sign in to BurnCare to read the reply."],
                )
        except Exception as problem:
            print("Could not email the staff member:", problem)

    return jsonify({"ok": True}), 201


@bp.post("/<int:consultation_id>/close")
@role_required("staff")
def close(user, consultation_id):
    row = query_one("SELECT * FROM consultations WHERE consultation_id = %s", (consultation_id,))
    if not row or (user["account_id"] != row["requested_by"] and not is_specialist(user)):
        return error("Consultation not found.", 404)
    execute("UPDATE consultations SET status = 'closed' WHERE consultation_id = %s", (consultation_id,))
    commit()
    return jsonify({"ok": True})