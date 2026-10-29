"""
BurnCare — assessments.py
-----------------------------------------------------------------------
Saving and reading burn assessments (guests, patients and staff).

API addresses (all start with /api/assessments):
  POST /                 save a new assessment (answers + burn photo)
  GET  /mine             the logged-in user's assessments (with reasons)
  GET  /<report_code>    one report, e.g. /api/assessments/BC-261021-7K4QX
  GET  /<report_code>/photo   the report's burn photo
  PATCH /<report_code>   the patient corrects their own answers or body map;
                         the burn size and the BBA result are worked out
                         again, and every change is kept in assessment_edits.
                         Locked once a healthcare professional has reviewed
                         the report (see review_info).

The photo is saved in the "uploads" folder; the database keeps its path.
The burn size (tbsa.py) and the result (referral.py) are worked out on
the server, so they can be trusted.
"""

import json
import os
import secrets
import uuid
from datetime import datetime, timezone

from flask import Blueprint, current_app, jsonify, request, send_from_directory

import referral
import tbsa
from auth import current_user, error, login_required
from db import commit, execute, query_all, query_one

bp = Blueprint("assessments", __name__, url_prefix="/api/assessments")

PHOTO_TYPES = {"image/jpeg": ".jpg", "image/png": ".png"}
MAX_PHOTO_BYTES = 10 * 1024 * 1024  # 10 MB

# The database saves "burn_unit"; the React page uses "burn-unit".
DECISION_FOR_PAGE = {"burn_unit": "burn-unit", "local": "local", "none": "none", "pending": "pending"}


# How each saved field is named in the report's change history.
FIELD_LABELS = {
    "emergency_breathing": "Breathing problems",
    "emergency_smoke": "Fire in a closed space / soot",
    "emergency_responsive": "Not awake or responding",
    "age_group": "Age",
    "cause": "Cause of the burn",
    "circumferential": "Goes all the way around",
    "not_healed": "Not healed after 2 weeks",
    "child_unwell": "Child unwell or feverish",
    "conditions": "Long-term conditions",
    "burn_areas": "Burned areas",
    "tbsa_percent": "Burn size (TBSA %)",
    "decision": "Result",
}


def review_info(assessment_id):
    """Has a healthcare professional reviewed this report? Then the patient
    can no longer change it. Reviewed = any of:
      - report_status is 'reviewed'
      - a staff member saved a clinical review (clinical_reviews)
      - a burn specialist answered a consultation about it
    Returns {"by": name, "at": ISO time} for the latest review, or None."""
    review = query_one(
        """
        SELECT who, at FROM (
            SELECT u.full_name AS who, r.created_at AS at
            FROM clinical_reviews r LEFT JOIN accounts u ON u.account_id = r.reviewed_by
            WHERE r.assessment_id = %s
            UNION ALL
            SELECT u.full_name, c.answered_at
            FROM consultations c LEFT JOIN accounts u ON u.account_id = c.specialist_id
            WHERE c.assessment_id = %s AND c.status IN ('answered', 'closed') AND c.answered_at IS NOT NULL
            UNION ALL
            SELECT NULL, a.updated_at
            FROM assessments a WHERE a.assessment_id = %s AND a.report_status = 'reviewed'
        ) reviews
        ORDER BY (who IS NULL), at DESC
        LIMIT 1
        """,
        (assessment_id, assessment_id, assessment_id),
    )
    if not review:
        return None
    return {"by": review["who"] or "BurnCare healthcare staff",
            "at": review["at"].astimezone().isoformat() if review["at"] else None}


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
               TO_CHAR(a.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_iso,
               TO_CHAR(a.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS updated_iso
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
    areas = [{"id": r["body_region"], "percent": float(r["percent"])} for r in query_all(
        "SELECT body_region, percent FROM burn_areas WHERE assessment_id = %s ORDER BY side, body_region",
        (assessment_id,),
    )]
    edits = [{
        "field": FIELD_LABELS.get(r["field_name"], r["field_name"]),
        "oldValue": r["old_value"],
        "newValue": r["new_value"],
        "editedAt": r["edited_iso"],
        "editedBy": r["full_name"] or "—",
    } for r in query_all(
        """
        SELECT e.field_name, e.old_value, e.new_value, u.full_name,
               TO_CHAR(e.edited_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS edited_iso
        FROM assessment_edits e LEFT JOIN accounts u ON u.account_id = e.edited_by
        WHERE e.assessment_id = %s ORDER BY e.edited_at DESC, e.edit_id DESC
        """,
        (assessment_id,),
    )]
    has_photo = query_one("SELECT 1 FROM burn_images WHERE assessment_id = %s", (assessment_id,)) is not None
    return {
        "id": row["report_code"],
        "createdAt": row["created_iso"],
        "updatedAt": row["updated_iso"],  # sent back when editing, to spot a change made meanwhile
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
        "areas": areas,          # the marked body-map areas and their %
        "hasPhoto": has_photo,
        "review": review_info(assessment_id),  # who reviewed it and when, or None
        "edits": edits,          # change history, newest first
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


def find_report(report_code):
    return query_one(
        "SELECT assessment_id, created_by, patient_id, updated_at FROM assessments WHERE report_code = %s",
        (report_code.upper(),),
    )


def can_open(row, user):
    """A guest report can be opened with its code; a report that belongs to
    an account only by that person, by approved staff, or by an admin."""
    if row["created_by"] is None and row["patient_id"] is None:
        return True
    return bool(user) and (
        user["account_id"] in (row["created_by"], row["patient_id"])
        or user["role"] == "admin"
        or (user["role"] == "staff" and user["staff_status"] == "approved")
    )


@bp.get("/<report_code>")
def get_assessment(report_code):
    """One full report."""
    row = find_report(report_code)
    if not row:
        return error("Report not found.", 404)
    user = current_user()
    if not can_open(row, user):
        return error("You do not have permission to open this report.", 403)
    report = report_json(row["assessment_id"])
    # Patients can correct their own reports (staff use their own Burn History).
    # Patients can correct their own reports until a healthcare professional
    # has reviewed them (staff use their own Burn History).
    report["canEdit"] = bool(user and user["role"] == "patient"
                             and user["account_id"] in (row["created_by"], row["patient_id"])
                             and report["review"] is None)
    return jsonify({"report": report})


@bp.get("/<report_code>/photo")
def get_photo(report_code):
    """The burn photo of one report (same permission as the report)."""
    row = find_report(report_code)
    if not row or not can_open(row, current_user()):
        return error("Report not found.", 404)
    image = query_one("SELECT file_path FROM burn_images WHERE assessment_id = %s ORDER BY image_no LIMIT 1",
                      (row["assessment_id"],))
    if not image:
        return error("This report has no photo.", 404)
    response = send_from_directory(current_app.config["UPLOAD_FOLDER"], os.path.basename(image["file_path"]))
    response.headers["Cache-Control"] = "private, no-store"  # medical photo: never kept by shared caches
    return response


@bp.patch("/<report_code>")
@login_required
def edit_assessment(user, report_code):
    """
    The patient corrects their own report. The page sends the whole form:
      {"emergency": {...}, "form": {...}, "bodyMap": [...], "updatedAt": "<from the report>"}
    The burn size and the BBA result are worked out again on the server, and
    each changed field is saved in assessment_edits (old value → new value).
    """
    row = find_report(report_code)
    if not row:
        return error("Report not found.", 404)
    if user["role"] != "patient" or user["account_id"] not in (row["created_by"], row["patient_id"]):
        return error("You can only edit your own reports.", 403)
    if review_info(row["assessment_id"]):
        return error("This report has been reviewed by a healthcare professional, so it can no longer be changed.", 403)

    data = request.get_json(silent=True) or {}
    emergency = data.get("emergency") or {}
    form = data.get("form") or {}
    problem = referral.check_answers(emergency, form)
    if problem:
        return error(problem)
    burn_size, problem = tbsa.calculate(form["age"], data.get("bodyMap"))
    if problem:
        return error(problem, field="tbsa")

    # Someone (e.g. the same patient in another tab) changed it meanwhile?
    old = report_json(row["assessment_id"])
    if data.get("updatedAt") != old["updatedAt"]:
        return error("This report was changed in the meantime. Please reload it and try again.", 409)

    analysis = {"tbsa": burn_size["total"], "burnedAreas": burn_size["specialAreas"],
                "depth": None, "confidence": None}
    decision, reasons, depth = referral.decide(emergency, form, analysis)
    child = referral.is_child(form["age"])
    child_unwell = form.get("childUnwell") if child else None

    # Old → new, as text, for the change history.
    def text(value):
        if value is None or value == "":
            return None
        if isinstance(value, list):
            return ", ".join(value) or None
        if isinstance(value, (int, float)):
            return f"{value:g}"  # 11.0 and 11 are the same number
        return str(value)

    fmt_areas = lambda areas: ", ".join(f"{a['id']} {a['percent']:g}%" for a in sorted(areas, key=lambda a: a["id"]))
    changes = {
        "emergency_breathing": (old["emergency"]["breathing"], emergency["breathing"]),
        "emergency_smoke": (old["emergency"]["smoke"], emergency["smoke"]),
        "emergency_responsive": (old["emergency"]["responsive"], emergency["responsive"]),
        "age_group": (old["form"]["age"], form["age"]),
        "cause": (old["form"]["cause"], form["cause"]),
        "circumferential": (old["form"]["circumferential"], form["circumferential"]),
        "not_healed": (old["form"]["notHealed"], form["notHealed"]),
        "child_unwell": (old["form"]["childUnwell"] or None, child_unwell),
        "conditions": (sorted(old["form"]["conditions"]), sorted(form["conditions"])),
        "burn_areas": (fmt_areas(old["areas"]), fmt_areas(burn_size["areas"])),
        "tbsa_percent": (old["tbsa"], burn_size["total"]),
        "decision": (old["result"]["decision"], DECISION_FOR_PAGE[decision]),
    }
    changed = {field: (text(a), text(b)) for field, (a, b) in changes.items() if text(a) != text(b)}
    if not changed:
        return error("Nothing was changed.")

    assessment_id = row["assessment_id"]
    execute(
        """
        UPDATE assessments
        SET emergency_breathing = %s, emergency_smoke = %s, emergency_responsive = %s,
            age_group = %s, cause = %s, circumferential = %s, not_healed = %s, child_unwell = %s,
            tbsa_percent = %s, burn_depth = %s, decision = %s, updated_at = NOW()
        WHERE assessment_id = %s
        """,
        (emergency["breathing"], emergency["smoke"], emergency["responsive"],
         form["age"], form["cause"], form["circumferential"], form["notHealed"], child_unwell,
         burn_size["total"], depth, decision, assessment_id),
    )
    # The lists are replaced as a whole (weak entities of assessments).
    execute("DELETE FROM assessment_conditions WHERE assessment_id = %s", (assessment_id,))
    for name in form["conditions"]:
        execute("INSERT INTO assessment_conditions (assessment_id, condition_name) VALUES (%s, %s)",
                (assessment_id, name))
    execute("DELETE FROM referral_reasons WHERE assessment_id = %s", (assessment_id,))
    for number, reason in enumerate(reasons, start=1):
        execute("INSERT INTO referral_reasons (assessment_id, reason_no, reason_text) VALUES (%s, %s, %s)",
                (assessment_id, number, reason))
    execute("DELETE FROM burn_areas WHERE assessment_id = %s", (assessment_id,))
    for area in burn_size["areas"]:
        execute("INSERT INTO burn_areas (assessment_id, body_region, side, percent) VALUES (%s, %s, %s, %s)",
                (assessment_id, area["id"], area["side"], area["percent"]))
    # The change history: one row per changed field.
    for field, (before, after) in changed.items():
        execute(
            """
            INSERT INTO assessment_edits (assessment_id, edited_by, field_name, old_value, new_value)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (assessment_id, user["account_id"], field, before, after),
        )
    commit()

    report = report_json(assessment_id)
    report["canEdit"] = True
    return jsonify({"report": report})