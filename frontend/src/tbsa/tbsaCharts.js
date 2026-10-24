/* =====================================================================
   BurnCare — tbsa/tbsaCharts.js
   ---------------------------------------------------------------------
   The TBSA rules, with no screen code, so they can be tested alone.

   Two layers:
     • REGIONS  the 35 shapes drawn on the body map (front and back):
                head, neck, chest, stomach, genitals, upper/lower back,
                buttocks, and upper arm, forearm, hand, thigh, lower leg
                and foot on each side.
     • AREAS    what the chart gives a percentage to. Each chart groups
                the shapes into its own areas:
                  - Lund and Browder (children): every shape is its own
                    area, as on the paper chart.
                  - Rule of Nines (adults): only the textbook areas, each
                    a multiple of 9 (e.g. a whole arm side = 4½, made of
                    upper arm + forearm + hand).
   Every chart adds up to exactly 100% (see tbsaCharts.check.js).
   ===================================================================== */

// ---------------------------------------------------------------------
// 1. The shapes on the body map
// ---------------------------------------------------------------------
// part: the kind of body part. Face (head), hands, feet and genitals are
// special areas in the BBA referral guidance.
const limb = (side, view) => {
  const cap = view === "front" ? "Front" : "Back";
  const name = side === "right" ? "Right" : "Left";
  return [
    { id: `${side}UpperArm${cap}`, label: `${name} upper arm`, view, part: "upperArm" },
    { id: `${side}Forearm${cap}`, label: `${name} forearm`, view, part: "forearm" },
    { id: `${side}Hand${cap}`, label: `${name} hand`, view, part: "hand" },
    { id: `${side}Thigh${cap}`, label: `${name} thigh`, view, part: "thigh" },
    { id: `${side}LowerLeg${cap}`, label: `${name} lower leg`, view, part: "lowerLeg" },
    { id: `${side}Foot${cap}`, label: `${name} foot`, view, part: "foot" },
  ];
};

export const REGIONS = [
  { id: "headFront", label: "Face & front of head", view: "front", part: "head" },
  { id: "neckFront", label: "Front of neck", view: "front", part: "neck" },
  { id: "chest", label: "Chest", view: "front", part: "chest" },
  { id: "abdomen", label: "Stomach", view: "front", part: "abdomen" },
  { id: "genitals", label: "Genitals / perineum", view: "front", part: "genitals" },
  ...limb("right", "front"),
  ...limb("left", "front"),
  { id: "headBack", label: "Back of head", view: "back", part: "head" },
  { id: "neckBack", label: "Back of neck", view: "back", part: "neck" },
  { id: "upperBack", label: "Upper back", view: "back", part: "upperBack" },
  { id: "lowerBack", label: "Lower back", view: "back", part: "lowerBack" },
  { id: "rightButtock", label: "Right buttock", view: "back", part: "buttock" },
  { id: "leftButtock", label: "Left buttock", view: "back", part: "buttock" },
  ...limb("right", "back"),
  ...limb("left", "back"),
];

export const REGION_BY_ID = Object.fromEntries(REGIONS.map((region) => [region.id, region]));

// Parts that the BBA referral guidance names as special areas.
export const SPECIAL_PARTS = { head: "Face", hand: "Hands", foot: "Feet", genitals: "Genitals" };

// ---------------------------------------------------------------------
// 2. The charts
// ---------------------------------------------------------------------
// Makes a chart from its areas, and a lookup "which area is this shape in".
//   areas: [{ id, label, value, regions: [shape ids], labelAt: shape id }]
function makeChart(id, label, areas) {
  const areaOf = {};
  for (const area of areas) for (const region of area.regions) areaOf[region] = area;
  return { id, label, areas, areaOf, areaById: Object.fromEntries(areas.map((a) => [a.id, a])) };
}

// Lund and Browder: one area per shape. The values are per side.
// A = ½ of head, B = ½ of one thigh, C = ½ of one lower leg (they change
// with age); everything else is the same at every age.
function lundBrowder(id, label, A, B, C) {
  const value = { head: A, thigh: B, lowerLeg: C, neck: 1, chest: 6.5, abdomen: 6.5, upperBack: 6.5,
    lowerBack: 6.5, buttock: 2.5, genitals: 1, upperArm: 2, forearm: 1.5, hand: 1.25, foot: 1.75 };
  return makeChart(
    id,
    label,
    REGIONS.map((r) => ({ id: r.id, label: r.label, value: value[r.part], regions: [r.id], labelAt: r.id })),
  );
}

// Rule of Nines: the textbook areas only. Each side (front or back) of an
// arm, leg or the head is half of that part's value.
function ruleOfNines() {
  const sides = [];
  for (const view of ["Front", "Back"]) {
    const lower = view.toLowerCase();
    sides.push({
      id: `head${view}`, label: `Head & neck (${lower})`, value: 4.5,
      regions: [`head${view}`, `neck${view}`], labelAt: `head${view}`,
    });
    for (const [side, name] of [["right", "Right"], ["left", "Left"]]) {
      sides.push(
        {
          id: `${side}Arm${view}`, label: `${name} arm (${lower})`, value: 4.5,
          regions: [`${side}UpperArm${view}`, `${side}Forearm${view}`, `${side}Hand${view}`], labelAt: `${side}UpperArm${view}`,
        },
        {
          id: `${side}Leg${view}`, label: `${name} leg (${lower})`, value: 9,
          regions: [`${side}Thigh${view}`, `${side}LowerLeg${view}`, `${side}Foot${view}`], labelAt: `${side}Thigh${view}`,
        },
      );
    }
  }
  return makeChart("adult", "Rule of Nines (adult)", [
    ...sides,
    { id: "chest", label: "Chest", value: 9, regions: ["chest"], labelAt: "chest" },
    { id: "abdomen", label: "Stomach", value: 9, regions: ["abdomen"], labelAt: "abdomen" },
    { id: "upperBack", label: "Upper back", value: 9, regions: ["upperBack"], labelAt: "upperBack" },
    {
      id: "lowerBack", label: "Lower back & buttocks", value: 9,
      regions: ["lowerBack", "rightButtock", "leftButtock"], labelAt: "lowerBack",
    },
    { id: "genitals", label: "Genitals / perineum", value: 1, regions: ["genitals"], labelAt: "genitals" },
  ]);
}

export const CHARTS = {
  lbUnder1: lundBrowder("lbUnder1", "Lund and Browder (under 1 year)", 9.5, 2.75, 2.5),
  lb1to4: lundBrowder("lb1to4", "Lund and Browder (1–4 years)", 8.5, 3.25, 2.5),
  lb5to9: lundBrowder("lb5to9", "Lund and Browder (5–9 years)", 6.5, 4, 2.75),
  lb10to14: lundBrowder("lb10to14", "Lund and Browder (10–14 years)", 5.5, 4.25, 3),
  lb15: lundBrowder("lb15", "Lund and Browder (15 years)", 4.5, 4.5, 3.25),
  adult: ruleOfNines(),
};

/**
 * Picks the chart from the age in years (0 = under 1 year).
 * A child is under 16, as defined by the British Burn Association's
 * National Burn Care Referral Guidance (2012).
 * Each step only checks the LOWER bound, so every age (including 4.5 or
 * 15.5) lands in exactly one chart: the column for the age reached.
 */
export function chooseChart(age) {
  if (age >= 16) return CHARTS.adult; // Rule of Nines
  if (age >= 15) return CHARTS.lb15;
  if (age >= 10) return CHARTS.lb10to14;
  if (age >= 5) return CHARTS.lb5to9;
  if (age >= 1) return CHARTS.lb1to4;
  return CHARTS.lbUnder1;
}

/** Child charts use the child body map (bigger head, shorter legs). */
export const isChildChart = (chosen) => chosen.id !== "adult";

/** Most palms an area can take: its value rounded down (4½% → 4). */
export const maxPalms = (chosen, areaId) => Math.floor(chosen.areaById[areaId].value);

// One palm of the patient's hand, fingers closed ≈ 1% of their body.
export const PALM_PERCENT = 1;

/** 1.25 → "1¼", 2.5 → "2½", 9 → "9" (as written on the paper chart). */
export function formatPercent(value) {
  const whole = Math.floor(value);
  const fraction = { 0.25: "¼", 0.5: "½", 0.75: "¾" }[Math.round((value - whole) * 100) / 100] ?? "";
  if (!fraction) return String(Math.round(value * 100) / 100);
  return `${whole || ""}${fraction}`;
}

// The special areas (face, hands, ...) inside one marked area. A whole
// area includes all its shapes; for palms, only the shapes tapped count.
function specialPartsOf(area, mark) {
  const shapes = mark.method === "whole" ? area.regions : (mark.touched ?? []).filter((r) => area.regions.includes(r));
  return shapes.map((r) => SPECIAL_PARTS[REGION_BY_ID[r].part]).filter(Boolean);
}

/**
 * Adds up the marked areas of the chosen chart.
 *   marks = { areaId: { method: "whole" | "palms", palms, touched: [shape ids] } }
 *   depth = 1, 2 or 3 (from the AI), or null while it isn't known.
 *           1st-degree burns are not counted. While the depth is unknown
 *           the area IS counted (the safer choice: it is not assumed to be
 *           a harmless 1st-degree burn).
 * Returns the total (capped at 100), a breakdown by area, and the
 * special areas involved (face, hands, feet, genitals).
 */
export function calculateTbsa(chosen, marks, depth) {
  const counted = depth !== 1;

  const breakdown = chosen.areas
    .filter((area) => marks[area.id])
    .map((area) => {
      const mark = marks[area.id];
      const palms = Math.min(mark.palms ?? 0, maxPalms(chosen, area.id));
      const percent = mark.method === "whole" ? area.value : palms * PALM_PERCENT;
      return { id: area.id, label: area.label, method: mark.method, palms, percent, touched: mark.touched ?? [] };
    });

  const sum = breakdown.reduce((total, row) => total + row.percent, 0);
  const total = counted ? Math.min(100, Math.round(sum * 100) / 100) : 0;
  const specialAreas = [
    ...new Set(breakdown.flatMap((row) => specialPartsOf(chosen.areaById[row.id], marks[row.id]))),
  ];

  return { chart: chosen.id, chartLabel: chosen.label, depth, counted, total, breakdown, specialAreas };
}