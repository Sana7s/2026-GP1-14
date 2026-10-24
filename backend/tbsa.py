"""
BurnCare — tbsa.py
-----------------------------------------------------------------------
Works out the burn size (TBSA %) on the SERVER, from the body map the
page sends. Same charts and rules as frontend/src/tbsa/tbsaCharts.js:
  - Lund and Browder, one column per age group (children are under 16,
    as in the BBA National Burn Care Referral Guidance, 2012), and its
    adult column for 16 and over
  - one palm of the patient's hand = 1%
  - a 1st-degree (superficial) burn is not counted; while the depth is
    not known yet, the area IS counted (the safer choice)

The page only sends WHICH areas are burned and how much ("whole area" or
a number of palms); the percentages are worked out here, so a changed
request cannot fake the burn size.
"""

import math

# The 35 body-map regions: id → (side of the body, part).
REGIONS = {
    "headFront": ("front", "head"), "neckFront": ("front", "neck"),
    "chest": ("front", "chest"), "abdomen": ("front", "abdomen"), "genitals": ("front", "genitals"),
    "headBack": ("back", "head"), "neckBack": ("back", "neck"),
    "upperBack": ("back", "upperBack"), "lowerBack": ("back", "lowerBack"),
    "rightButtock": ("back", "buttock"), "leftButtock": ("back", "buttock"),
}
for _side in ("right", "left"):
    for _view in ("Front", "Back"):
        for _name, _part in (("UpperArm", "upperArm"), ("Forearm", "forearm"), ("Hand", "hand"),
                             ("Thigh", "thigh"), ("LowerLeg", "lowerLeg"), ("Foot", "foot")):
            REGIONS[f"{_side}{_name}{_view}"] = (_view.lower(), _part)

# Lund and Browder: the same at every age (per side of each part).
_LB_FIXED = {"neck": 1, "upperArm": 2, "forearm": 1.5, "hand": 1.25, "foot": 1.75, "genitals": 1,
             "buttock": 2.5, "chest": 6.5, "abdomen": 6.5, "upperBack": 6.5, "lowerBack": 6.5}


def _lund_browder(head, thigh, lower_leg):
    """Every shape is its own area. A = ½ head, B = ½ thigh, C = ½ lower leg."""
    value = {**_LB_FIXED, "head": head, "thigh": thigh, "lowerLeg": lower_leg}
    return {region: {"value": value[part], "regions": [region]} for region, (_side, part) in REGIONS.items()}


def _rule_of_nines():
    """Only the textbook areas: each is a group of shapes."""
    areas = {
        "chest": {"value": 9, "regions": ["chest"]},
        "abdomen": {"value": 9, "regions": ["abdomen"]},
        "upperBack": {"value": 9, "regions": ["upperBack"]},
        "lowerBack": {"value": 9, "regions": ["lowerBack", "rightButtock", "leftButtock"]},
        "genitals": {"value": 1, "regions": ["genitals"]},
    }
    for view in ("Front", "Back"):
        areas[f"head{view}"] = {"value": 4.5, "regions": [f"head{view}", f"neck{view}"]}
        for side in ("right", "left"):
            areas[f"{side}Arm{view}"] = {"value": 4.5, "regions": [f"{side}UpperArm{view}", f"{side}Forearm{view}", f"{side}Hand{view}"]}
            areas[f"{side}Leg{view}"] = {"value": 9, "regions": [f"{side}Thigh{view}", f"{side}LowerLeg{view}", f"{side}Foot{view}"]}
    return areas


# Each chart: area id → {"value": % per area, "regions": [shapes in it]}.
CHARTS = {
    "lbUnder1": _lund_browder(9.5, 2.75, 2.5),
    "lb1to4": _lund_browder(8.5, 3.25, 2.5),
    "lb5to9": _lund_browder(6.5, 4, 2.75),
    "lb10to14": _lund_browder(5.5, 4.25, 3),
    "lb15": _lund_browder(4.5, 4.5, 3.25),
    "adult": _rule_of_nines(),
}

# The age groups of the assessment form → their chart.
CHART_FOR_AGE_GROUP = {
    "Under 1 year": "lbUnder1",
    "1 – 4 years": "lb1to4",
    "5 – 9 years": "lb5to9",
    "10 – 14 years": "lb10to14",
    "15 years": "lb15",
    "16 years or older": "adult",
}

# Parts that the BBA names as special areas (referral.py).
SPECIAL_PARTS = {"head": "Face", "hand": "Hands", "foot": "Feet", "genitals": "Genitals"}

_UNREADABLE = "The body map could not be read. Please mark the areas again."


def calculate(age_group, body_map, depth=None):
    """
    body_map: [{"id": area id, "method": "whole" | "palms", "palms": 1,
                "touched": [shape ids tapped inside the area]}, ...]
    depth:    "superficial", "partial", "full", or None (not known yet)
    Returns (result, problem). result = {
        "total": 12.5, "chart": "adult",
        "areas": [{"id", "side", "percent"}],   # for the burn_areas table
        "specialAreas": ["Hands", ...] }         # for referral.py
    """
    if not isinstance(body_map, list) or not body_map:
        return None, "Please mark the burned areas on the body map."
    chart_id = CHART_FOR_AGE_GROUP.get(age_group)
    if not chart_id:
        return None, "Please choose the patient's age."
    chart = CHARTS[chart_id]

    areas, special, seen = [], set(), set()
    for item in body_map:
        area_id = item.get("id") if isinstance(item, dict) else None
        if area_id not in chart or area_id in seen:
            return None, _UNREADABLE
        seen.add(area_id)
        area = chart[area_id]

        if item.get("method") == "whole":
            percent = area["value"]
            shapes = area["regions"]  # the whole area: every shape in it
        elif item.get("method") == "palms":
            palms = item.get("palms")
            if not isinstance(palms, int) or isinstance(palms, bool) or palms < 1:
                return None, _UNREADABLE
            percent = min(palms, math.floor(area["value"]))  # 1 palm = 1%, never more than the area
            touched = item.get("touched") or []
            shapes = [r for r in touched if r in area["regions"]] if isinstance(touched, list) else []
        else:
            return None, _UNREADABLE

        for shape in shapes:
            part = REGIONS[shape][1]
            if part in SPECIAL_PARTS:
                special.add(SPECIAL_PARTS[part])
        areas.append({"id": area_id, "side": REGIONS[area["regions"][0]][0], "percent": percent})

    counted = depth != "superficial"
    total = min(100, round(sum(a["percent"] for a in areas), 2)) if counted else 0
    return {"total": total, "chart": chart_id, "areas": areas, "specialAreas": sorted(special)}, ""