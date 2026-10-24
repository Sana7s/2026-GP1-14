/* =====================================================================
   BurnCare — patientData.js
   ---------------------------------------------------------------------
   Shared helpers and labels for the patient pages.
   ===================================================================== */

// "Sara Alharbi" → "SA" (shown in the round profile picture).
export const initials = (name) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

// Health lists for the Profile page — the SAME lists as the patient
// Register page (RegisterPages.jsx), so a saved answer is found again.
// "Other (not listed)" opens a text box; the typed text is saved instead.
export const OTHER_OPTION = "Other (not listed)";

export const CHRONIC_CONDITIONS = [
  "None",
  "Diabetes",
  "High blood pressure",
  "Heart disease",
  "Kidney disease",
  "Asthma or lung disease",
  OTHER_OPTION,
];

export const ALLERGIES = [
  "None",
  "Penicillin",
  "Sulfa drugs",
  "Aspirin or anti-inflammatory drugs",
  "Latex",
  "Iodine or contrast dye",
  "Food allergy",
  OTHER_OPTION,
];

export const MEDICATIONS = [
  "None",
  "Insulin",
  "Diabetes tablets (e.g. Metformin)",
  "Blood thinners (e.g. Warfarin, Aspirin)",
  "Blood pressure medicine",
  "Steroids (e.g. Prednisolone)",
  "Immune-suppressing medicine",
  OTHER_OPTION,
];

// The possible results of an assessment, keyed by the "decision" Flask
// sends (assessments.py). Same wording as the report in PatientEntry.jsx.
export const RESULT_LEVELS = {
  "burn-unit": { label: "Treat at a burn unit", tone: "urgent" },
  local: { label: "Treat locally", tone: "soon" },
  none: { label: "First aid at home", tone: "home" },
  pending: { label: "Result pending", tone: "pending" },
};