/* =====================================================================
   BurnCare — content.js
   ---------------------------------------------------------------------
   All the text shown on the website (Home and About pages), the
   "How it works" steps, the feature cards, and the top-bar links.
   Change the wording here and every page that uses it updates.
   ===================================================================== */

/* =====================================================================
   1. PAGE CONTENT
   ---------------------------------------------------------------------
   All the text for the Home and About pages lives here, written from the
   BurnCare Sprint-0 report. If the Flask server is running, it can send
   new text that replaces these values (see the App component below).
   ===================================================================== */
const DEFAULT_CONTENT = {
  brandName: "BurnCare",

  // The slogan: the big headline on the Home page.
  tagline: "Know the burn. Act in time.",

  // The short line under the slogan.
  heroSubtitle:
    "Upload a photo of a burn, answer six quick questions, and get an AI-assisted estimate of burn depth and urgency in moments.",

  // The large sentence that lights up word-by-word on the Home page.
  homeDescription:
    "A burn's outcome is largely decided in the first 24 to 48 hours. BurnCare combines a burn photo with key clinical details to estimate burn depth and urgency, so the right care can start sooner.",

  // The opening paragraph of the About page.
  aboutIntro:
    "BurnCare is an AI-powered burn assessment and triage platform. It analyzes a photo of a burn together with key clinical information to estimate burn depth and surgical urgency, helping patients and healthcare staff make timely, informed care decisions wherever a burn occurs.",


  vision:
    "To bring specialist-level burn assessment to wherever a burn happens, from homes and rural communities to emergency rooms without a dedicated burn unit, so every patient reaches the right care in time.",

  mission:
    "To provide patients and healthcare staff with fast, accessible, and explainable burn assessment by combining AI image analysis with clinical information, supporting accurate triage and timely referral to surgical care.",

  // The project supervisor, shown first in the "Meet the team" row.
  supervisor: {
    id: "supervisor",
    name: "Dr. Lama Alzaben",
    role: "Supervisor & Product Owner",
    bio: "Department of Information Technology, King Saud University. Guides the BurnCare team and sets the product direction.",
  },

  // The four developers.
  developers: [
    {
      id: 1,
      name: "Sana Aljaber",
      role: "Project Leader & Developer",
      bio: "Leads the BurnCare project and develops the platform and its features.",
    },
    {
      id: 2,
      name: "Lana Alhussaini",
      role: "Scrum Master & Developer",
      bio: "Leads the team's Scrum process and develops the BurnCare platform.",
    },
    {
      id: 3,
      name: "Shatha Alharthi",
      role: "Developer",
      bio: "Software developer on the BurnCare team, building the platform and its features.",
    },
    {
      id: 4,
      name: "Reema Al-Saud",
      role: "Developer",
      bio: "Software developer on the BurnCare team, building the platform and its features.",
    },
  ],
};

// The three steps of an assessment (Home page, "How it works").
const STEPS = [
  {
    title: "Upload a photo",
    text: "Take or upload a clear photo of the burn from your phone or computer.",
  },
  {
    title: "Add six details",
    text: "Age, pain level (0–10), cause of the burn, its location, time since injury, and diabetes status. Type them or say them out loud.",
  },
  {
    title: "Get your report",
    text: "See the estimated burn depth, urgency level, confidence score, and a heatmap that explains the result.",
  },
];

// The six main features (Home page, "What BurnCare does").
const FEATURES = [
  {
    icon: "depth",
    title: "Burn depth estimate",
    text: "A deep-learning model reads the photo together with your clinical details to estimate how deep the burn is.",
  },
  {
    icon: "triage",
    title: "Urgency triage",
    text: "Every result is classified as Routine, Urgent, or Emergency to help decide how quickly care is needed.",
  },
  {
    icon: "body",
    title: "Body map (TBSA)",
    text: "Tap the burned areas on a front-and-back body diagram to estimate the Total Body Surface Area affected.",
  },
  {
    icon: "heatmap",
    title: "Heatmap explanations",
    text: "A colour-coded Grad-CAM heatmap shows which parts of the photo influenced the AI's prediction.",
  },
  {
    icon: "voice",
    title: "Voice entry",
    text: "Enter clinical details by speaking instead of typing, which helps when hands are busy.",
  },
  {
    icon: "report",
    title: "PDF reports",
    text: "Download your assessment as a PDF to share with a doctor or healthcare provider.",
  },
];

// The links in the top bar. "to" is the web address of each page.
const NAV_ITEMS = [
  { label: "Home", to: "/" },
  { label: "Guest", to: "/guest" },
  { label: "About Us", to: "/about" },
  { label: "Register", to: "/register" },
  { label: "Login", to: "/login" },
];

export { DEFAULT_CONTENT, STEPS, FEATURES, NAV_ITEMS };
