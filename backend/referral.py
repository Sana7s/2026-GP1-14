"""
BurnCare — referral.py
-----------------------------------------------------------------------
The BBA referral decision. This is the same logic as decideResult() in
GuestPage.jsx, moved to the server so the saved result can be trusted.

It combines:
  1. the answers (emergency check + case questions)
  2. the body map (burn size in % = TBSA, and which areas are burned)
  3. the AI photo check (burn depth and confidence)
and returns one of: "burn_unit", "local", "none" — or "pending" while
the body map and the AI are not connected yet — plus the reasons.
"""

# Answers that count as risky ("Not sure" is treated as risky).
RISKY = ("Yes", "Not sure")

ADULT = "16 years or older"
AGE_GROUPS = ["Under 1 year", "1 – 4 years", "5 – 9 years", "10 – 14 years", "15 years", ADULT]

BURN_CAUSES = [
    "Hot liquid or steam", "Fire or flame", "Hot object", "Electricity", "Chemical",
    "Friction", "Cold injury (frostbite)", "Sun", "Other",
]
# Causes that need a burn unit at ANY size.
BURN_UNIT_CAUSES = ["Electricity", "Chemical", "Friction", "Cold injury (frostbite)"]

CONDITIONS = ["Diabetes", "Heart or blood vessel disease", "Kidney disease", "Weak immune system", "Other", "None"]

# Burn size limits (TBSA %): this size or bigger goes to a burn unit.
TBSA_LIMIT = {"child": 2, "adult": 3}

# Body areas that need a burn unit at ANY size (blistered or deeper).
SPECIAL_AREAS = ["Face", "Hands", "Feet", "Genitals", "Perineum"]

# Below this AI confidence, the AI depth counts as one level deeper (safer).
MIN_AI_CONFIDENCE = 0.6


def is_child(age_group):
    """Every age group except "16 years or older" is a child (under 16)."""
    return age_group != "" and age_group != ADULT


def safe_depth(depth, confidence):
    """If the AI is not sure enough, use the next deeper level."""
    if not depth:
        return None
    if confidence is not None and confidence < MIN_AI_CONFIDENCE:
        if depth == "superficial":
            return "partial"
        if depth == "partial":
            return "full"
    return depth


def decide(emergency, form, analysis):
    """
    emergency: {"breathing", "smoke", "responsive"}
    form:      {"age", "cause", "circumferential", "conditions", "notHealed", "childUnwell"}
    analysis:  {"tbsa", "burnedAreas", "depth", "confidence"}
    Returns (decision, reasons, depth_used).
    """
    reasons = []
    depth = safe_depth(analysis.get("depth"), analysis.get("confidence"))
    tbsa = analysis.get("tbsa")
    child = is_child(form["age"])

    # ----- Rules from the ANSWERS -----
    if any(value in RISKY for value in emergency.values()):
        reasons.append("Possible breathing injury or emergency sign (emergency check)")
    if form["cause"] in BURN_UNIT_CAUSES:
        reasons.append(f"{form['cause']} burns need a burn unit at any size")
    if form["circumferential"] in RISKY:
        reasons.append("The burn may go all the way around a body part")
    conditions = [c for c in form["conditions"] if c != "None"]
    if conditions:
        reasons.append(f"Long-term condition that could slow healing ({', '.join(conditions)})")
    if form["notHealed"] == "Yes":
        reasons.append("The burn has not healed after 2 weeks")
    if child and form.get("childUnwell") in RISKY:
        reasons.append("A child with a burn who seems unwell or has a fever")

    # ----- Rule from the PHOTO (AI depth) -----
    if depth == "full":
        reasons.append("Full-thickness (deep) burn seen in the photo")

    # ----- Rules from the BODY MAP -----
    limit = TBSA_LIMIT["child"] if child else TBSA_LIMIT["adult"]
    if tbsa is not None and depth != "superficial" and tbsa >= limit:
        who = "a child" if child else "an adult"
        reasons.append(f"Burn size {tbsa}% is at or above the {limit}% limit for {who}")
    special = [area for area in analysis.get("burnedAreas", []) if area in SPECIAL_AREAS]
    if special and depth in ("partial", "full"):
        reasons.append(f"Blistered or deeper burn on a special area ({', '.join(special)})")

    # ----- The result -----
    if reasons:
        return "burn_unit", reasons, depth
    if tbsa is None or depth is None:
        return "pending", reasons, depth
    if depth == "superficial":
        return "none", ["Red skin only (no blisters) and no BBA referral reason"], depth
    return "local", [
        f"Blistered burn under the {limit}% limit, not on a special area, and no other BBA referral reason"
    ], depth


def check_answers(emergency, form):
    """Returns a problem message, or "" when every required answer is valid."""
    for key, allowed in (("breathing", ("Yes", "No", "Not sure")),
                         ("smoke", ("Yes", "No", "Not sure")),
                         ("responsive", ("Yes", "No"))):
        if emergency.get(key) not in allowed:
            return f"Please answer emergency question '{key}'."
    if form.get("age") not in AGE_GROUPS:
        return "Please choose the patient's age."
    if form.get("cause") not in BURN_CAUSES:
        return "Please choose the cause of the burn."
    if form.get("circumferential") not in ("Yes", "No", "Not sure"):
        return "Please answer whether the burn goes all the way around."
    conditions = form.get("conditions")
    if not isinstance(conditions, list) or not conditions or any(c not in CONDITIONS for c in conditions):
        return "Please choose the long-term conditions (or None)."
    if "None" in conditions and len(conditions) > 1:
        return "'None' cannot be chosen together with a condition."
    if form.get("notHealed") not in ("Yes", "No"):
        return "Please answer whether the burn has healed."
    if is_child(form["age"]) and form.get("childUnwell") not in ("Yes", "No", "Not sure"):
        return "Please answer whether the child is unwell or feverish."
    return ""
