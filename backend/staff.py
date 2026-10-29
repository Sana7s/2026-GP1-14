"""
BurnCare — staff.py
-----------------------------------------------------------------------
The healthcare staff pages (/staff/...), on the same PostgreSQL database
as the patient and guest reports. Only ADMIN-APPROVED staff can use these
addresses (role_required checks it).

API addresses (all start with /api/staff):
  GET  /summary                     the staff home page: recent reports,
                                    waiting consultations, counts
  GET  /reports?q=...               the reports this staff member works on:
                                    made by them, reviewed by them, or with
                                    a consultation they asked or answered
  GET  /reports/<code>              one report + clinical details + reviews
                                    + its consultations (any approved staff
                                    can open a report with its Report ID)
  PUT  /reports/<code>/clinical     save the clinical details (patient
                                    reference, pain, time since injury,
                                    diabetes, history, notes)
  POST /reports/<code>/review       the clinician's review: final decision,
                                    depth, adjusted TBSA and the reason.
                                    After a review the patient can no
                                    longer edit the report (assessments.py).

Consultations (ask a specialist / answer) use consultations.py.
"""

from datetime import date

from flask import Blueprint, jsonify, request

import assessments
from assessments import DECISION_FOR_PAGE, find_report, report_json
from auth import error, role_required
from consultations import is_specialist
from db import commit, execute, query_all, query_one

bp = Blueprint("staff", __name__, url_prefix="/api/staff")

TIME_SINCE = ["Less than 2 hours", "2 to 6 hours", "6 to 24 hours", "More than 24 hours"]
DIABETES = ["Non-Diabetic", "Diabetic", "Unknown"]
DEPTHS = ["superficial", "partial", "full"]
DECISION_FROM_PAGE = {page: db_value for db_value, page in DECISION_FOR_PAGE.items() if db_value != "pending"}

# Names of the clinical fields in the report's change history.
assessments.FIELD_LABELS.update({
    "medical_record_no": "Hospital file number",
    "injury_date": "Date of injury",
    "pain_level": "Pain level (0–10)",
    "time_since_injury": "Time since injury",
    "diabetes_status": "Diabetes status",
    "medical_history": "Medical history",
    "clinical_notes": "Clinical notes",
})


# =====================================================================
# HELPERS
# =====================================================================

def clinical_json(row):
    """The clinical details of one assessment row (empty strings when not filled)."""
    return {
        "patientRef": row["medical_record_no"] or "",
        "injuryDate": row["injury_date"].isoformat() if row["injury_date"] else "",
        "pain": row["pain_level"] if row["pain_level"] is not None else "",
        "timeSince": row["time_since_injury"] or "",
        "diabetes": row["diabetes_status"] or "",
        "medicalHistory": row["medical_history"] or "",
        "notes": row["clinical_notes"] or "",
    }


def check_clinical(data):
    """Checks the clinical details typed by staff. Returns (values, problem)."""
    # Optional: the hospital's own file number. (Every report already has
    # its own Report ID, made automatically, e.g. BC-261029-7K4QX.)
    ref = str(data.get("patientRef") or "").strip()
    if len(ref) > 30:
        return None, ("The hospital file number can be up to 30 characters.", "patientRef")

    try:
        injury = date.fromisoformat(str(data.get("injuryDate") or ""))
    except ValueError:
        return None, ("Please choose the date of the injury.", "injuryDate")
    if injury > date.today() or injury.year < 1900:
        return None, ("The date of the injury can't be in the future.", "injuryDate")

    pain = data.get("pain")
    if isinstance(pain, str) and pain.strip().isdigit():
        pain = int(pain)
    if not isinstance(pain, int) or isinstance(pain, bool) or not 0 <= pain <= 10:
        return None, ("Please choose a pain level from 0 to 10.", "pain")

    if data.get("timeSince") not in TIME_SINCE:
        return None, ("Please choose how long ago the burn happened.", "timeSince")
    if data.get("diabetes") not in DIABETES:
        return None, ("Please choose the diabetes status.", "diabetes")

    history = str(data.get("medicalHistory") or "").strip()
    notes = str(data.get("notes") or "").strip()
    if len(history) > 700:
        return None, ("Medical history can be up to 700 characters.", "medicalHistory")
    if len(notes) > 1000:
        return None, ("Clinical notes can be up to 1,000 characters.", "notes")

    return {
        "medical_record_no": ref or None,
        "injury_date": injury,
        "pain_level": pain,
        "time_since_injury": data["timeSince"],
        "diabetes_status": data["diabetes"],
        "medical_history": history or None,
        "clinical_notes": notes or None,
    }, None


def reviews_of(assessment_id):
    rows = query_all(
        """
        SELECT r.final_decision, r.final_depth, r.old_tbsa, r.adjusted_tbsa, r.reason, r.notes,
               u.full_name,
               TO_CHAR(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_iso
        FROM clinical_reviews r LEFT JOIN accounts u ON u.account_id = r.reviewed_by
        WHERE r.assessment_id = %s ORDER BY r.created_at DESC
        """,
        (assessment_id,),
    )
    return [{
        "decision": DECISION_FOR_PAGE[r["final_decision"]],
        "depth": r["final_depth"],
        "oldTbsa": float(r["old_tbsa"]) if r["old_tbsa"] is not None else None,
        "adjustedTbsa": float(r["adjusted_tbsa"]) if r["adjusted_tbsa"] is not None else None,
        "reason": r["reason"],
        "notes": r["notes"],
        "by": r["full_name"] or "—",
        "at": r["created_iso"],
    } for r in rows]


def consultations_of(user, assessment_id):
    """The consultations about this report that this staff member may see."""
    rows = query_all(
        """
        SELECT c.consultation_id, c.question, c.status, u.full_name AS asked_by, s.full_name AS specialist,
               TO_CHAR(c.created_at, 'FMDD Mon YYYY, HH24:MI') AS created
        FROM consultations c
        JOIN accounts u ON u.account_id = c.requested_by
        LEFT JOIN accounts s ON s.account_id = c.specialist_id
        WHERE c.assessment_id = %s
          AND (c.requested_by = %s OR c.specialist_id = %s OR (%s AND c.status = 'open' AND c.specialist_id IS NULL))
        ORDER BY c.created_at DESC
        """,
        (assessment_id, user["account_id"], user["account_id"], is_specialist(user)),
    )
    return [{"id": r["consultation_id"], "question": r["question"], "status": r["status"],
             "askedBy": r["asked_by"], "specialist": r["specialist"], "createdAt": r["created"]} for r in rows]


# The reports one staff member works on (see the top of this file).
REPORT_LIST_SQL = """
    SELECT a.report_code, a.decision, a.cause, a.age_group, a.tbsa_percent, a.medical_record_no,
           TO_CHAR(a.created_at, 'FMDD Mon YYYY, HH24:MI') AS created,
           ac.full_name AS assessed_by, ac.role AS assessed_role,
           EXISTS (SELECT 1 FROM clinical_reviews r WHERE r.assessment_id = a.assessment_id) AS reviewed
    FROM assessments a
    LEFT JOIN accounts ac ON ac.account_id = a.created_by
    WHERE (a.created_by = %(me)s
       OR EXISTS (SELECT 1 FROM clinical_reviews r
                  WHERE r.assessment_id = a.assessment_id AND r.reviewed_by = %(me)s)
       OR EXISTS (SELECT 1 FROM consultations c
                  WHERE c.assessment_id = a.assessment_id
                    AND (c.requested_by = %(me)s OR c.specialist_id = %(me)s
                         OR (%(specialist)s AND c.status = 'open' AND c.specialist_id IS NULL))))
      AND (%(q)s = '' OR a.report_code ILIKE %(like)s OR COALESCE(a.medical_record_no, '') ILIKE %(like)s
           OR a.cause ILIKE %(like)s)
    ORDER BY a.created_at DESC
    LIMIT %(limit)s
"""


def report_list(user, query="", limit=200):
    rows = query_all(REPORT_LIST_SQL, {
        "me": user["account_id"], "specialist": is_specialist(user),
        "q": query, "like": f"%{query}%", "limit": limit,
    })
    return [{
        "id": r["report_code"],
        "decision": DECISION_FOR_PAGE[r["decision"]],
        "cause": r["cause"],
        "age": r["age_group"],
        "tbsa": float(r["tbsa_percent"]) if r["tbsa_percent"] is not None else None,
        "patientRef": r["medical_record_no"] or "",
        "createdAt": r["created"],
        # Who made it: a guest, the patient themself, or a staff member.
        "source": "guest" if r["assessed_by"] is None else ("patient" if r["assessed_role"] == "patient" else "staff"),
        "assessedBy": r["assessed_by"] or "Guest",
        "reviewed": r["reviewed"],
    } for r in rows]


# =====================================================================
# ROUTES
# =====================================================================

@bp.get("/summary")
@role_required("staff")
def summary(user):
    """Everything the staff home page shows."""
    waiting = None
    if is_specialist(user):
        waiting = query_one(
            "SELECT COUNT(*) AS n FROM consultations WHERE status = 'open' AND specialist_id IS NULL"
        )["n"]
    my_open = query_one(
        "SELECT COUNT(*) AS n FROM consultations WHERE requested_by = %s AND status = 'open'",
        (user["account_id"],),
    )["n"]
    answered = query_one(
        "SELECT COUNT(*) AS n FROM consultations WHERE requested_by = %s AND status = 'answered'",
        (user["account_id"],),
    )["n"]
    return jsonify({
        "recent": report_list(user, limit=4),
        "waitingConsultations": waiting,       # None for staff who aren't burn specialists
        "myOpenQuestions": my_open,
        "myAnsweredQuestions": answered,
    })


@bp.get("/reports")
@role_required("staff")
def list_reports(user):
    query = str(request.args.get("q") or "").strip()[:40]
    return jsonify({"reports": report_list(user, query)})


@bp.get("/reports/<report_code>")
@role_required("staff")
def get_report(user, report_code):
    """Any approved staff member can open a report with its Report ID (the
    patient shares it with them), like a paper referral."""
    row = find_report(report_code.strip().upper())
    if not row:
        return error("No report has this Report ID. Please check it and try again.", 404)
    assessment_id = row["assessment_id"]
    details = query_one(
        """
        SELECT medical_record_no, injury_date, pain_level, time_since_injury, diabetes_status,
               medical_history, clinical_notes
        FROM assessments WHERE assessment_id = %s
        """,
        (assessment_id,),
    )
    return jsonify({
        "report": report_json(assessment_id),
        "clinical": clinical_json(details),
        "reviews": reviews_of(assessment_id),
        "consultations": consultations_of(user, assessment_id),
        "isSpecialist": is_specialist(user),
    })


@bp.put("/reports/<report_code>/clinical")
@role_required("staff")
def save_clinical(user, report_code):
    row = find_report(report_code.strip().upper())
    if not row:
        return error("Report not found.", 404)
    values, problem = check_clinical(request.get_json(silent=True) or {})
    if problem:
        return error(problem[0], field=problem[1])

    assessment_id = row["assessment_id"]
    old = query_one(
        f"SELECT {', '.join(values)} FROM assessments WHERE assessment_id = %s", (assessment_id,)
    )
    execute(
        f"""
        UPDATE assessments SET {', '.join(f'{field} = %s' for field in values)}, updated_at = NOW()
        WHERE assessment_id = %s
        """,
        (*values.values(), assessment_id),
    )
    # Change history: only when a value that was already there changes
    # (filling them in the first time is not a "change").
    for field, new in values.items():
        before = old[field]
        if before is None or str(before) == str(new):
            continue
        long_text = field in ("medical_history", "clinical_notes")
        execute(
            """
            INSERT INTO assessment_edits (assessment_id, edited_by, field_name, old_value, new_value)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (assessment_id, user["account_id"], field,
             "(previous text)" if long_text else str(before),
             "(updated)" if long_text else (str(new) if new is not None else None)),
        )
    commit()
    return jsonify({"clinical": clinical_json(query_one(
        """
        SELECT medical_record_no, injury_date, pain_level, time_since_injury, diabetes_status,
               medical_history, clinical_notes
        FROM assessments WHERE assessment_id = %s
        """,
        (assessment_id,),
    ))})


@bp.post("/reports/<report_code>/review")
@role_required("staff")
def review(user, report_code):
    """The clinician's review of a report. It is saved in clinical_reviews
    (one row per review, so earlier reviews stay in the history)."""
    row = find_report(report_code.strip().upper())
    if not row:
        return error("Report not found.", 404)
    data = request.get_json(silent=True) or {}

    decision = DECISION_FROM_PAGE.get(data.get("decision"))
    if not decision:
        return error("Please choose your decision for this burn.", field="decision")
    depth = data.get("depth") or None
    if depth is not None and depth not in DEPTHS:
        return error("Please choose a valid burn depth.", field="depth")

    adjusted = data.get("adjustedTbsa")
    if adjusted in ("", None):
        adjusted = None
    else:
        try:
            adjusted = round(float(adjusted), 2)
        except (TypeError, ValueError):
            return error("The burn size must be a number.", field="adjustedTbsa")
        if not 0 <= adjusted <= 100:
            return error("The burn size must be between 0 and 100%.", field="adjustedTbsa")

    reason = str(data.get("reason") or "").strip()
    if len(reason) < 3:
        return error("Please write the reason for your decision.", field="reason")
    if len(reason) > 500:
        return error("The reason can be up to 500 characters.", field="reason")
    notes = str(data.get("notes") or "").strip()[:1000] or None

    current = query_one("SELECT tbsa_percent FROM assessments WHERE assessment_id = %s", (row["assessment_id"],))
    execute(
        """
        INSERT INTO clinical_reviews (assessment_id, reviewed_by, old_tbsa, adjusted_tbsa,
                                      final_decision, final_depth, reason, notes)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (row["assessment_id"], user["account_id"], current["tbsa_percent"], adjusted,
         decision, depth, reason, notes),
    )
    commit()
    return jsonify({"reviews": reviews_of(row["assessment_id"])}), 201