/* =====================================================================
   BurnCare — staffData.js   (put it in src/, next to auth.js)
   ---------------------------------------------------------------------
   Shared words, lists and small helpers for the healthcare staff pages
   (/staff/...). The lists match backend/staff.py exactly.
   ===================================================================== */

import { DECISIONS } from "./assessmentOptions.js";
import { RESULT_LEVELS } from "./patientData.js";

// A result's name (the SAME words as the top of the report) and colour.
export const resultOf = (decision) => ({
  label: (DECISIONS[decision] ?? DECISIONS.pending).title,
  tone: (RESULT_LEVELS[decision] ?? RESULT_LEVELS.pending).tone,
});

// Who can use which staff tool. The server checks the same rules again;
// these only decide what the pages show.
export const isApproved = (account) => account?.staffStatus === "approved";
export const isSpecialist = (account) => isApproved(account) && Boolean(account?.canGiveConsultations);

// Approval status → badge text and colour.
export const APPROVAL = {
  approved: { label: "Approved", tone: "is-approved" },
  pending: { label: "Waiting for approval", tone: "is-waiting" },
  changes_requested: { label: "Changes requested", tone: "is-waiting" },
};

// "Dr. Saad Al-Ghamdi" → "Dr. Saad"; "Noura Al-Qahtani" → "Noura".
export function shortName(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/);
  return /^(dr|prof)\.?$/i.test(parts[0]) && parts[1] ? `${parts[0]} ${parts[1]}` : parts[0] || "";
}

// ----- Clinical details (the extra questions staff answer) -----
export const TIME_SINCE = ["Less than 2 hours", "2 to 6 hours", "6 to 24 hours", "More than 24 hours"];
export const DIABETES = ["Non-Diabetic", "Diabetic", "Unknown"];
export const PAIN_LEVELS = Array.from({ length: 11 }, (_, i) => i); // 0 … 10

export const EMPTY_CLINICAL = {
  patientRef: "",
  injuryDate: "",
  pain: "",
  timeSince: "",
  diabetes: "",
  medicalHistory: "",
  notes: "",
};

// Today as "2026-10-29" in the user's own time zone (for the date box).
export const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

// Checks the clinical details before sending them. Returns
// { key, message } for the first problem, or null when all is fine.
export function clinicalProblem(clinical) {
  if (!clinical.injuryDate) return { key: "injuryDate", message: "Please choose the date of the injury." };
  if (clinical.injuryDate > today()) return { key: "injuryDate", message: "The date of the injury can't be in the future." };
  if (clinical.pain === "") return { key: "pain", message: "Please choose the pain level." };
  if (!clinical.timeSince) return { key: "timeSince", message: "Please choose how long ago the burn happened." };
  if (!clinical.diabetes) return { key: "diabetes", message: "Please choose the diabetes status." };
  return null;
}

// ----- The clinician's review -----
export const REVIEW_DECISIONS = [
  { value: "burn-unit", label: "Treat at a burn unit" },
  { value: "local", label: "Treat locally" },
  { value: "none", label: "No treatment needed" },
];

export const DEPTHS = [
  { value: "superficial", label: "Superficial (1st degree)" },
  { value: "partial", label: "Partial thickness (2nd degree)" },
  { value: "full", label: "Full thickness (3rd degree)" },
];
export const depthLabel = (value) => DEPTHS.find((d) => d.value === value)?.label ?? "—";

// Who made a report.
export const SOURCE_LABEL = {
  patient: "Patient's own assessment",
  guest: "Guest assessment",
  staff: "Staff assessment",
};

// Consultation status → badge text and colour.
export const CONSULT_STATUS = {
  open: { label: "Waiting for a specialist", tone: "is-waiting" },
  answered: { label: "Answered", tone: "is-approved" },
  closed: { label: "Closed", tone: "is-closed" },
};

// "2026-10-24T09:12:00Z" → "24 Oct 2026, 12:12"
export const niceDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

// Report IDs look like BC-261029-7K4QX.
export const REPORT_ID_PATTERN = /^BC-\d{6}-[A-Z0-9]{5}$/;
export const cleanReportId = (text) => String(text || "").trim().toUpperCase();