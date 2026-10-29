/* =====================================================================
   BurnCare — assessmentOptions.js  
   ---------------------------------------------------------------------
   The questions, answer choices and result texts of the burn
   assessment
   ===================================================================== */

export const EMERGENCY_QUESTIONS = [
  {
    key: "breathing",
    label: "Is the person struggling to breathe, or does their voice sound rough?",
    options: ["Yes", "No", "Not sure"],
  },
  {
    key: "smoke",
    label: "Did the burn happen in a fire inside a room or car, or is there black soot around the nose or mouth?",
    options: ["Yes", "No", "Not sure"],
  },
  {
    key: "responsive",
    label: "Is the person not awake, or not responding normally?",
    options: ["Yes", "No"],
  },
];

// "Not sure" counts as risky, like "Yes".
export const RISKY_ANSWERS = ["Yes", "Not sure"];

export const ADULT = "16 years or older";
export const AGE_GROUPS = ["Under 1 year", "1 – 4 years", "5 – 9 years", "10 – 14 years", "15 years", ADULT];

// The TBSA calculator needs an age in years: each group → its youngest age.
export const AGE_IN_YEARS = {
  "Under 1 year": 0,
  "1 – 4 years": 1,
  "5 – 9 years": 5,
  "10 – 14 years": 10,
  "15 years": 15,
  [ADULT]: 16,
};

export const BURN_CAUSES = [
  "Hot liquid or steam",
  "Fire or flame",
  "Hot object",
  "Electricity",
  "Chemical",
  "Friction",
  "Cold injury (frostbite)",
  "Sun",
  "Other",
];

export const CONDITIONS = ["Diabetes", "Heart or blood vessel disease", "Kidney disease", "Weak immune system", "Other", "None"];

// Under 16 = a child (BBA referral guidance).
export const isChild = (age) => age !== "" && age !== ADULT;

// How each result is shown at the top of a report.
export const DECISIONS = {
  "burn-unit": {
    title: "Treat at a burn unit",
    text: "Go to a hospital with a burn unit as soon as possible.",
  },
  local: {
    title: "Treat locally",
    text: "This burn can be treated at a nearby clinic or hospital.",
  },
  none: {
    title: "No treatment needed",
    text: "This burn only needs first aid at home. Watch for warning signs.",
  },
  pending: {
    title: "Result pending",
    text: "Your answers show no urgent warning sign. The final result needs the burn size and photo check. If the burn gets worse or you are worried, see a doctor.",
  },
};