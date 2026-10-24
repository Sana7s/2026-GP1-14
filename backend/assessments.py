"""
BurnCare — assessments.py
-----------------------------------------------------------------------
Saving and reading burn assessments (guests, patients and staff).

API addresses (all start with /api/assessments):
  POST /                 save a new assessment (answers + burn photo)
  GET  /mine             the logged-in user's assessments (with reasons)
  GET  /<report_code>    one report, e.g. /api/assessments/BC-261021-7K4QX

The photo is saved in the "uploads" folder; the database keeps its path.
The burn size (tbsa.py) and the result (referral.py) are worked out on
the server, so they can be trusted.
"""

import json
import os
import secrets
import uuid
from datetime import datetime, timezone

from flask import Blueprint, current_app, jsonify, request

import referral
import tbsa
from auth import current_user, error, login_required
from db import commit, execute, query_all, query_one

bp = Blueprint("assessments", __name__, url_prefix="/api/assessments")

PHOTO_TYPES = {"image/jpeg": ".jpg", "image/png": ".png"}
MAX_PHOTO_BYTES = 10 * 1024 * 1024  # 10 MB

# The database saves "burn_unit"; the React page uses "burn-unit".
DECISION_FOR_PAGE = {"burn_unit": "burn-unit", "local": "local", "none": "none", "pending": "pending"}


def make_report_code():
    """A report number like BC-261021-7K4QX (no 0/O or 1/I, easy to read)."""
    letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    today = datetime.now(timezone.utc).strftime("%y%m%d")
    code = "".join(secrets.choice(letters) for _ in range(5))
    return f"BC-{today}-{code}"


def report_json(assessment_id):
    """Everything about one assessment, in the shape the React report uses."""
    row = query_one(
        """
        SELECT a.*, ac.full_name AS assessed_by,
               TO_CHAR(a.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_iso
        FROM assessments a
        LEFT JOIN accounts ac ON ac.account_id = a.created_by   -- NULL = guest
        WHERE a.assessment_id = %s
        """,
        (assessment_id,),
    )
    conditions = [r["condition_name"] for r in query_all(
        "SELECT condition_name FROM assessment_conditions WHERE assessment_id = %s ORDER BY condition_name",
        (assessment_id,),
    )]
    reasons = [r["reason_text"] for r in query_all(
        "SELECT reason_text FROM referral_reasons WHERE assessment_id = %s ORDER BY reason_no",
        (assessment_id,),
    )]
    return {
        "id": row["report_code"],
        "createdAt": row["created_iso"],
        "assessedBy": row["assessed_by"] or "Guest",
        "emergency": {
            "breathing": row["emergency_breathing"],
            "smoke": row["emergency_smoke"],
            "responsive": row["emergency_responsive"],
        },
        "form": {
            "age": row["age_group"],
            "cause": row["cause"],
            "circumferential": row["circumferential"],
            "conditions": conditions,
            "notHealed": row["not_healed"],
            "childUnwell": row["child_unwell"] or "",
        },
        "tbsa": float(row["tbsa_percent"]) if row["tbsa_percent"] is not None else None,
        "depth": row["burn_depth"],
        "result": {"decision": DECISION_FOR_PAGE[row["decision"]], "reasons": reasons},
    }


@bp.post("")
def create_assessment():
    """
    The page sends a "multipart form" with two parts:
      data  → the answers as JSON text:
              {"emergency": {...}, "form": {...}, "bodyMap": [...]}
              (bodyMap is optional: the Guest page doesn't send it yet)
      photo → the burn photo (JPG or PNG, up to 10 MB)
    """
    try:
        data = json.loads(request.form.get("data", "{}"))
    except json.JSONDecodeError:
        return error("The answers could not be read.")
    emergency = data.get("emergency") or {}
    form = data.get("form") or {}

    problem = referral.check_answers(emergency, form)
    if problem:
        return error(problem)

    # ----- Check the photo -----
    photo = request.files.get("photo")
    if not photo or not photo.filename:
        return error("Please add a photo of the burn.", field="photo")
    if photo.mimetype not in PHOTO_TYPES:
        return error("Please choose a JPG or PNG image.", field="photo")
    photo_bytes = photo.read()
    if not photo_bytes or len(photo_bytes) > MAX_PHOTO_BYTES:
        return error("Please choose a photo under 10 MB.", field="photo")

    # ----- Body map: the burn size (TBSA), worked out again here -----
    burn_size = None
    if "bodyMap" in data:
        burn_size, problem = tbsa.calculate(form["age"], data["bodyMap"])
        if problem:
            return error(problem, field="tbsa")

    # ----- AI photo check (not connected yet) -----
    # TODO: send the photo to the AI model here and fill depth/confidence.
    # Until then, low-risk answers give the result "pending".
    analysis = {
        "tbsa": burn_size["total"] if burn_size else None,
        "burnedAreas": burn_size["specialAreas"] if burn_size else [],
        "depth": None,
        "confidence": None,
    }
    decision, reasons, depth = referral.decide(emergency, form, analysis)

    # ----- Save the photo file with a random name -----
    folder = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(folder, exist_ok=True)
    file_name = uuid.uuid4().hex + PHOTO_TYPES[photo.mimetype]
    with open(os.path.join(folder, file_name), "wb") as out:
        out.write(photo_bytes)

    # ----- Save everything in the database -----
    user = current_user()  # None for guests
    child = referral.is_child(form["age"])
    # A patient's own assessment is about the patient, so patient_id is
    # filled too. Staff can then open the patient's medical history.
    patient_id = user["account_id"] if user and user["role"] == "patient" else None

    # Try a few report codes in the (very unlikely) case one already exists.
    for _ in range(5):
        code = make_report_code()
        if not query_one("SELECT 1 FROM assessments WHERE report_code = %s", (code,)):
            break

    saved = query_one(
        """
        INSERT INTO assessments (report_code, patient_id, created_by, emergency_breathing, emergency_smoke,
            emergency_responsive, age_group, cause, circumferential, not_healed, child_unwell,
            tbsa_percent, burn_depth, decision)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING assessment_id
        """,
        (code, patient_id, user["account_id"] if user else None,
         emergency["breathing"], emergency["smoke"], emergency["responsive"],
         form["age"], form["cause"], form["circumferential"], form["notHealed"],
         form.get("childUnwell") if child else None,
         analysis["tbsa"], depth, decision),
    )
    assessment_id = saved["assessment_id"]

    # Each burned area of the body map (weak entity of assessments).
    for area in (burn_size["areas"] if burn_size else []):
        execute("INSERT INTO burn_areas (assessment_id, body_region, side, percent) VALUES (%s, %s, %s, %s)",
                (assessment_id, area["id"], area["side"], area["percent"]))
    for name in form["conditions"]:
        execute("INSERT INTO assessment_conditions (assessment_id, condition_name) VALUES (%s, %s)",
                (assessment_id, name))
    # Reasons are numbered 1, 2, 3 ... inside each assessment (weak entity).
    for number, text in enumerate(reasons, start=1):
        execute("INSERT INTO referral_reasons (assessment_id, reason_no, reason_text) VALUES (%s, %s, %s)",
                (assessment_id, number, text))
    execute(
        """
        INSERT INTO burn_images (assessment_id, image_no, file_path, mime_type, size_bytes, ai_depth, ai_confidence)
        VALUES (%s, 1, %s, %s, %s, %s, %s)
        """,
        (assessment_id, file_name, photo.mimetype, len(photo_bytes),
         analysis["depth"], analysis["confidence"]),
    )
    commit()

    return jsonify({"report": report_json(assessment_id)}), 201


@bp.get("/mine")
@login_required
def my_assessments(user):
    """The logged-in user's own assessments, newest first, with the
    referral reasons (for the My reports page)."""
    rows = query_all(
        """
        SELECT a.report_code, a.decision, a.cause, a.age_group, a.circumferential,
               TO_CHAR(a.created_at, 'FMDD Mon YYYY, HH24:MI') AS created,
               -- the reasons, in order, as one list (empty list if none)
               COALESCE((SELECT ARRAY_AGG(r.reason_text ORDER BY r.reason_no)
                         FROM referral_reasons r WHERE r.assessment_id = a.assessment_id),
                        '{}') AS reasons
        FROM assessments a
        WHERE a.created_by = %s OR a.patient_id = %s
        ORDER BY a.created_at DESC
        """,
        (user["account_id"], user["account_id"]),
    )
    return jsonify({"assessments": [{
        "id": r["report_code"],
        "decision": DECISION_FOR_PAGE[r["decision"]],
        "cause": r["cause"],
        "age": r["age_group"],
        "circumferential": r["circumferential"],
        "reasons": r["reasons"],
        "createdAt": r["created"],
    } for r in rows]})


@bp.get("/<report_code>")
def get_assessment(report_code):
    """One report. A guest report can be opened with its code; a report
    that belongs to an account can only be opened by that person, by
    approved staff, or by an admin."""
    row = query_one("SELECT assessment_id, created_by, patient_id FROM assessments WHERE report_code = %s",
                    (report_code.upper(),))
    if not row:
        return error("Report not found.", 404)
    if row["created_by"] is not None or row["patient_id"] is not None:
        user = current_user()
        allowed = user and (
            user["account_id"] in (row["created_by"], row["patient_id"])
            or user["role"] == "admin"
            or (user["role"] == "staff" and user["staff_status"] == "approved")
        )
        if not allowed:
            return error("You do not have permission to open this report.", 403)
    return jsonify({"report": report_json(row["assessment_id"])})