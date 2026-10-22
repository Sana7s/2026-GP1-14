/* =====================================================================
   BurnCare — patientData.js
   ---------------------------------------------------------------------
   SAMPLE DATA for the patient pages, so they can be built and shown
   before the backend is ready.
   TODO (backend): replace each of these with data loaded from Flask.
   ===================================================================== */

// The signed-in patient and their profile.
// dob is YYYY-MM-DD. diabetes is one of the DIABETES_OPTIONS values.
export const DEMO_PATIENT = {
  name: "Sara Alharbi",
  dob: "1992-05-18",
  weight: "62",
  height: "165",
  phone: "+966 50 123 4567",
  email: "sara@example.com",
  diabetes: "no",
  otherConditions: "",
};

// "Sara Alharbi" → "SA" (shown in the round profile picture).
export const initials = (name) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

// Answers for "Do you have diabetes?" (one of the six assessment inputs).
export const DIABETES_OPTIONS = [
  { value: "no", label: "No" },
  { value: "type1", label: "Type 1" },
  { value: "type2", label: "Type 2" },
  { value: "unsure", label: "Not sure" },
];

// The three possible results of an assessment.
export const RESULT_LEVELS = {
  unit: { label: "Go to a burn unit", tone: "urgent" },
  doctor: { label: "See a doctor", tone: "soon" },
  home: { label: "Treat at home", tone: "home" },
};

// The patient's latest reports (newest first).
export const DEMO_REPORTS = [
  { id: 3, level: "doctor", date: "12 Oct 2026", area: "Left forearm" },
  { id: 2, level: "home", date: "28 Sep 2026", area: "Right hand" },
  { id: 1, level: "home", date: "3 Sep 2026", area: "Back of the neck" },
];

// The burn being followed up. Photos are image addresses, or null if none yet.
export const DEMO_RECOVERY = {
  day: 8,
  burnDate: "12 Oct 2026",
  firstPhoto: null,
  latestPhoto: null,
};