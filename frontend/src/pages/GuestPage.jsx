/* =====================================================================
   BurnCare — pages/GuestPage.jsx
   ---------------------------------------------------------------------
   The Guest assessment page (address: /guest). No account needed.

   The page has THREE screens, shown one after another:
     1. Emergency check — 3 quick safety questions on their own page.
        Any "Yes" (or "Not sure") opens an urgent message telling the
        user to call 997 (a message only, it does not place a call).
     2. Assessment form — the case questions, the body map (TBSA) and
        the burn photo. Every question is required.
     3. Report — a paper-style report with a unique ID, all the answers
        and the photo, with the BBA decision at the top.

   When "Assess case" is pressed, the answers, the body map and the photo
   are sent to the Flask backend (POST /api/assessments). Flask works out
   the burn size again (tbsa.py) and the BBA decision (referral.py),
   saves everything in the database and sends back the report.
   The body map is the TBSA calculator (components/TbsaCalculator.jsx),
   the same one the Patient assessment uses.

   The questions follow the British Burn Association (BBA) referral
   thresholds (see the "BurnCare Assessment Form Questions" document).
   ===================================================================== */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { prefersReducedMotion } from "../components/animations.jsx";
import { Chevron } from "../components/Chevron.jsx";
import BodyMap from "../components/BodyMap.jsx";
import TbsaCalculator from "../components/TbsaCalculator.jsx";
import { chooseChart, formatPercent, isChildChart } from "../tbsa/tbsaCharts.js";
import { api } from "../api.js";

/* ---------------------------------------------------------------------
   QUESTIONS AND ANSWER CHOICES
   --------------------------------------------------------------------- */

// Screen 1: the emergency check (everyday words, one screen).
const EMERGENCY_QUESTIONS = [
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

// Answers that count as an emergency ("Not sure" is treated as risky).
const EMERGENCY_ANSWERS = ["Yes", "Not sure"];

// Screen 2: answer choices for each case question.
// Age groups follow the Lund and Browder chart, which BBA recommends for
// measuring burn size, because children's body proportions change with
// age. Each group also maps to BBA's child (under 16) or adult limit.
const ADULT = "16 years or older";
const AGE_GROUPS = [
  "Under 1 year", //   child — Lund and Browder age 0
  "1 – 4 years", //    child — Lund and Browder age 1
  "5 – 9 years", //    child — Lund and Browder age 5
  "10 – 14 years", //  child — Lund and Browder age 10
  "15 years", //       child — Lund and Browder age 15
  ADULT, //            adult — Lund and Browder adult
];

const BURN_CAUSES = [
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

const CONDITIONS = [
  "Diabetes",
  "Heart or blood vessel disease",
  "Kidney disease",
  "Weak immune system",
  "Other",
  "None",
];

// Photo rules: JPG or PNG, up to 10 MB.
const PHOTO_TYPES = ["image/jpeg", "image/png"];
const MAX_PHOTO_MB = 10;

// The empty answers: nothing is chosen until the user picks an answer.
const EMPTY_EMERGENCY = { breathing: "", smoke: "", responsive: "" };
const EMPTY_FORM = {
  age: "",
  cause: "",
  circumferential: "",
  conditions: [], // several can be chosen
  notHealed: "", // burn older than 2 weeks and still not healed?
  childUnwell: "", // only asked when the patient is a child
};


/* ---------------------------------------------------------------------
   SMALL HELPERS
   --------------------------------------------------------------------- */

// Is the patient a child (under 16)? Every group except the last one.
const isChild = (age) => age !== "" && age !== ADULT;

// The TBSA calculator needs an age in years to choose its chart. Each age
// group → the youngest age in it (the same chart for the whole group).
const AGE_IN_YEARS = {
  "Under 1 year": 0,
  "1 – 4 years": 1,
  "5 – 9 years": 5,
  "10 – 14 years": 10,
  "15 years": 15,
  [ADULT]: 16,
};

// Did any emergency answer say "Yes" or "Not sure"?
const hasEmergency = (emergency) =>
  Object.values(emergency).some((value) => EMERGENCY_ANSWERS.includes(value));

/* ---------------------------------------------------------------------
   THE BBA DECISION and the report number are now worked out by the
   Flask backend (backend/referral.py and backend/assessments.py), so the
   saved result can be trusted. This page only shows what Flask returns.
   --------------------------------------------------------------------- */

// How each decision is shown at the top of the report.
const DECISIONS = {
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
    text: "This burn only needs first aid at home. Watch for the warning signs below.",
  },
  pending: {
    title: "Waiting for photo and body-map analysis",
    text:
      "None of your answers require a burn unit. The final result (No treatment needed, Treat locally or Treat at a burn unit) will appear here once the AI photo check and body map are connected.",
  },
};

/* =====================================================================
   THE PAGE
   ===================================================================== */
function GuestPage() {
  const [screen, setScreen] = useState("emergency"); // "emergency" | "form" | "report"
  const [slide, setSlide] = useState(""); // slide animation direction
  const [emergency, setEmergency] = useState(EMPTY_EMERGENCY); // screen 1 answers
  const [form, setForm] = useState(EMPTY_FORM); // screen 2 answers
  const [photo, setPhoto] = useState(null); // the chosen photo file
  const [photoUrl, setPhotoUrl] = useState(""); // preview link for the photo
  const [photoProblem, setPhotoProblem] = useState(""); // wrong file type/size
  const [missing, setMissing] = useState([]); // keys of unanswered questions
  const [showAlert, setShowAlert] = useState(false); // "missing answer" pop-up
  const [showCall, setShowCall] = useState(false); // "Call 997" pop-up
  const [report, setReport] = useState(null); // the finished report
  const [dragging, setDragging] = useState(false); // photo dragged over box?
  const [saving, setSaving] = useState(false); // waiting for the server?
  const [saveError, setSaveError] = useState(""); // message if saving failed
  const [tbsa, setTbsa] = useState(null); // latest result from the body map
  const [mapKey, setMapKey] = useState(0); // change it to clear the body map
  const fileInputRef = useRef(null);

  const child = isChild(form.age);

  // The required questions on the screen the user is looking at.
  // "label" is shown in the pop-up; "check" says whether it is answered.
  const required =
    screen === "emergency"
      ? EMERGENCY_QUESTIONS.map((q, i) => ({
          key: q.key,
          label: `Emergency question ${i + 1}`,
          answered: emergency[q.key] !== "",
        }))
      : [
          { key: "age", label: "Patient's age", answered: form.age !== "" },
          { key: "cause", label: "Cause of the burn", answered: form.cause !== "" },
          { key: "circumferential", label: "Burn all the way around", answered: form.circumferential !== "" },
          { key: "conditions", label: "Long-term conditions", answered: form.conditions.length > 0 },
          { key: "notHealed", label: "Burn not healed after 2 weeks", answered: form.notHealed !== "" },
          // Only required when the patient is a child.
          ...(child ? [{ key: "childUnwell", label: "Child unwell or feverish", answered: form.childUnwell !== "" }] : []),
          { key: "tbsa", label: "Burned areas on the body map", answered: Boolean(tbsa?.breakdown.length) },
          { key: "photo", label: "Burn photo", answered: Boolean(photo) },
        ];

  // The pop-up shows ONE missing question at a time: the first in the list.
  const current = required.find(({ key }) => missing.includes(key));
  const isMissing = (key) => current?.key === key;

  // (The pop-up only shows while a question is still missing — see
  // "showAlert && current" below — so it closes by itself.)

  // Free the memory used by an old photo preview.
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  // Remove a question from the missing list once it is answered.
  const clearMissing = (key) => setMissing((old) => old.filter((item) => item !== key));

  // Save one emergency answer. A risky answer opens the "Call 997" pop-up.
  const answerEmergency = (key, value) => {
    setEmergency((old) => ({ ...old, [key]: value }));
    clearMissing(key);
    if (EMERGENCY_ANSWERS.includes(value)) setShowCall(true);
  };

  // Save one case answer.
  const answer = (key, value) => {
    setForm((old) => ({ ...old, [key]: value }));
    clearMissing(key);
  };

  // Conditions: several can be chosen. "None" clears the others, and
  // choosing a condition clears "None".
  const toggleCondition = (_, option) => {
    setForm((old) => {
      let list;
      if (option === "None") list = old.conditions.includes("None") ? [] : ["None"];
      else if (old.conditions.includes(option)) list = old.conditions.filter((c) => c !== option);
      else list = [...old.conditions.filter((c) => c !== "None"), option];
      return { ...old, conditions: list };
    });
    clearMissing("conditions");
  };

  // Check a chosen photo (type and size), then save it and show a preview.
  const choosePhoto = (file) => {
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) {
      setPhotoProblem("Please choose a JPG or PNG image.");
      return;
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      setPhotoProblem(`This photo is too large. Please choose one under ${MAX_PHOTO_MB} MB.`);
      return;
    }
    setPhotoProblem("");
    setPhoto(file);
    setPhotoUrl(URL.createObjectURL(file));
    clearMissing("photo");
  };

  const removePhoto = () => {
    setPhoto(null);
    setPhotoUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Scroll to a question and give it a small shake so it is easy to spot.
  const goToQuestion = (key) => {
    const box = document.getElementById(`field-${key}`);
    if (!box) return;
    box.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
    box.classList.remove("is-flashing");
    void box.offsetWidth; // restarts the shake animation
    box.classList.add("is-flashing");
  };

  const scrollToTop = () =>
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });

  // Shows a different screen with a slide animation.
  const goToScreen = (next, direction) => {
    setMissing([]);
    setShowAlert(false);
    setSlide(direction);
    setScreen(next);
    scrollToTop();
  };

  // Checks the current screen. If something is missing, shows the pop-up
  // and goes to the first missing question. Returns true when complete.
  const checkScreen = () => {
    const notAnswered = required.filter((q) => !q.answered).map((q) => q.key);
    if (notAnswered.length) {
      setMissing(notAnswered);
      setShowAlert(true);
      goToQuestion(notAnswered[0]);
      return false;
    }
    return true;
  };

  // "Next" on the emergency check.
  const handleNext = () => {
    if (checkScreen()) goToScreen("form", "slide-forward");
  };

  // "Assess case" on the form: send everything to Flask, show the report.
  const handleSubmit = async (event) => {
    event.preventDefault(); // stop the page from reloading
    if (!checkScreen() || saving) return;

    // The photo and the answers go together in one "multipart form".
    const upload = new FormData();
    // Body map: only WHICH areas and how much (the server adds them up again).
    const bodyMap = tbsa.breakdown.map(({ id, method, palms, touched }) => ({ id, method, palms, touched }));
    upload.append("data", JSON.stringify({ emergency, form, bodyMap }));
    upload.append("photo", photo);

    setSaving(true);
    setSaveError("");
    try {
      // Flask saves the assessment and returns the finished report:
      // its number, the answers, and the BBA decision with its reasons.
      const { report: saved } = await api("/api/assessments", { method: "POST", form: upload });
      setReport({
        id: saved.id,
        createdAt: new Date(saved.createdAt),
        emergency: saved.emergency,
        form: saved.form,
        photoUrl, // the photo preview already in the browser
        assessedBy: saved.assessedBy, // the account's name, or "Guest"
        result: saved.result,
        tbsa: saved.tbsa, // burn size worked out by the server
        bodyMap: tbsa, // the marked areas, to list them on the report
      });
      goToScreen("report", "slide-forward");
    } catch (problem) {
      setSaveError(problem.message);
    } finally {
      setSaving(false);
    }
  };

  // Clear everything so the user can start a new case.
  const startOver = () => {
    setEmergency(EMPTY_EMERGENCY);
    setForm(EMPTY_FORM);
    removePhoto();
    setPhotoProblem("");
    setReport(null);
    setTbsa(null);
    setMapKey((key) => key + 1); // a fresh, empty body map
    goToScreen("emergency", "slide-back");
  };

  /* ---------- Screen 3: the report ---------- */
  if (screen === "report" && report) {
    return (
      <section className="guest-page">
        <div className={`guest-container report-container ${slide}`}>
          <Report report={report} />
          <ReportActions report={report} onStartOver={startOver} />
        </div>
      </section>
    );
  }

  /* ---------- Screens 1 and 2 ---------- */
  return (
    <section className="guest-page">
      {/* ===== Pop-up: shows the next missing question (one at a time) ===== */}
      {showAlert && current && (
        <div className="missing-alert" role="alert" key={current.key}>
          <span className="missing-alert-icon" aria-hidden="true">!</span>
          <div className="missing-alert-body">
            <p className="missing-alert-title">Required question not answered</p>
            <p className="missing-alert-text">
              Please answer <strong>{current.label}</strong> before you continue.
            </p>
            <button type="button" className="missing-alert-go" onClick={() => goToQuestion(current.key)}>
              Go to question <Chevron />
            </button>
          </div>
          <button
            type="button"
            className="missing-alert-close"
            onClick={() => setShowAlert(false)}
            aria-label="Close message"
          >
            ×
          </button>
        </div>
      )}

      {/* ===== Pop-up: "Call 997 now" ===== */}
      {showCall && <CallPopup onClose={() => setShowCall(false)} />}

      <div className="guest-container">
        {/* ===== Page title (left) + emergency notice (right) ===== */}
        <header className="guest-header">
          <div>
            <h1>Guest Assessment</h1>
            <p className="guest-subtitle">
              {screen === "emergency" ? "Part 1 of 2 · Emergency check" : "Part 2 of 2 · Burn details"}
            </p>
          </div>

          <aside className="emergency-note" aria-label="Emergency information">
            <span className="emergency-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M12 3l9.5 17h-19L12 3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M12 10v4.5M12 17.5v.01" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <p>
              <strong>In an emergency</strong>
              If the person gets worse at any time, call <span className="emergency-number">997</span> right away.
            </p>
          </aside>
        </header>

        {screen === "emergency" ? (
          /* ===================== SCREEN 1: EMERGENCY CHECK ===================== */
          <div className={`guest-panel ${slide}`}>
            <section className="guest-step">
              <div className="guest-step-head">
                <span className="guest-step-label">Before you start</span>
                <h2 className="guest-step-title">Three quick safety questions</h2>
              </div>

              <div className="field-grid">
                {EMERGENCY_QUESTIONS.map((q) => (
                  <Question key={q.key} id={q.key} label={q.label} missing={isMissing(q.key)}>
                    <ChoiceButtons
                      name={q.key}
                      options={q.options}
                      value={emergency[q.key]}
                      onChoose={answerEmergency}
                      variant="segmented"
                    />
                  </Question>
                ))}
              </div>
            </section>

            <div className="guest-submit">
              <button type="button" className="button button-primary button-wide" onClick={handleNext}>
                Next <Chevron />
              </button>
              <p>All questions are required.</p>
            </div>
          </div>
        ) : (
          /* ===================== SCREEN 2: ASSESSMENT FORM ===================== */
          // noValidate: we show our own friendly messages instead of the browser's.
          <form className={`guest-panel ${slide}`} onSubmit={handleSubmit} noValidate>
            {/* ===== STEP 1: case questions ===== */}
            <section className="guest-step">
              <div className="guest-step-head guest-step-head-row">
                <div>
                  <span className="guest-step-label">Step 1</span>
                  <h2 className="guest-step-title">About the burn</h2>
                </div>
                {/* Back arrow → returns to the emergency check (answers are kept). */}
                <button type="button" className="back-button" onClick={() => goToScreen("emergency", "slide-back")}>
                  <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                    <path d="M8 2L4 6l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Back
                </button>
              </div>

              <div className="field-grid">
                {/* 1. Age — Lund and Browder age groups (under 16 = child for BBA) */}
                <Question id="age" label="How old is the patient?" missing={isMissing("age")}>
                  <ChoiceButtons name="age" options={AGE_GROUPS} value={form.age} onChoose={answer} variant="chips" />
                </Question>

                {/* 2. Cause of the burn — choice pills */}
                <Question id="cause" label="What caused the burn?" missing={isMissing("cause")}>
                  <ChoiceButtons name="cause" options={BURN_CAUSES} value={form.cause} onChoose={answer} variant="chips" />
                </Question>

                {/* 3. Circumferential — Yes / No / Not sure */}
                <Question
                  id="circumferential"
                  label="Does the burn go all the way around an arm, leg, finger, neck or chest?"
                  missing={isMissing("circumferential")}
                >
                  <ChoiceButtons
                    name="circumferential"
                    options={["Yes", "No", "Not sure"]}
                    value={form.circumferential}
                    onChoose={answer}
                    variant="segmented"
                  />
                </Question>

                {/* 4. Long-term conditions — several can be chosen */}
                <Question
                  id="conditions"
                  label="Does the patient have a long-term condition that could slow healing?"
                  hint="Choose all that apply."
                  missing={isMissing("conditions")}
                >
                  <ChoiceButtons
                    name="conditions"
                    options={CONDITIONS}
                    value={form.conditions}
                    onChoose={toggleCondition}
                    variant="chips"
                    multiple
                  />
                </Question>

                {/* 5. Not healed after 2 weeks (BBA: refer any burn not healed in 2 weeks) */}
                <Question
                  id="notHealed"
                  label="Has the burn been there for more than 2 weeks without healing?"
                  missing={isMissing("notHealed")}
                >
                  <ChoiceButtons name="notHealed" options={["Yes", "No"]} value={form.notHealed} onChoose={answer} variant="segmented" />
                </Question>

                {/* 6. Only for children (under 16) */}
                {child && (
                  <Question
                    id="childUnwell"
                    label="Does the child seem unwell or have a fever?"
                    missing={isMissing("childUnwell")}
                    appear
                  >
                    <ChoiceButtons
                      name="childUnwell"
                      options={["Yes", "No", "Not sure"]}
                      value={form.childUnwell}
                      onChoose={answer}
                      variant="segmented"
                    />
                  </Question>
                )}
              </div>
            </section>

            {/* ===== STEP 2: TBSA body map ===== */}
            <section className="guest-step">
              <StepHeader number={2} title="Where is the burn?" />
              <div id="field-tbsa" className={`field${isMissing("tbsa") ? " is-missing" : ""}`}>
                <TbsaCalculator
                  key={mapKey}
                  age={form.age ? AGE_IN_YEARS[form.age] : null}
                  depth={null} // TODO (AI): the burn depth from the photo check
                  onChange={setTbsa}
                />
                {isMissing("tbsa") && <p className="field-error">Please mark the burned areas on the body map.</p>}
              </div>
            </section>

            {/* ===== STEP 3: photo upload ===== */}
            <section className="guest-step">
              <StepHeader number={3} title="Burn photo" />
              <p className="guest-step-note">
                Take the photo from above, about 30–50 cm away, in good light, after cooling and before any cream.
              </p>

              <div id="field-photo" className={`field${isMissing("photo") ? " is-missing" : ""}`}>
                {photoUrl ? (
                  // A photo is chosen: show the preview with Change / Remove.
                  <div className="photo-preview">
                    <img src={photoUrl} alt="Your uploaded burn photo" />
                    <div className="photo-preview-bar">
                      <span className="photo-name">{photo?.name}</span>
                      <div className="photo-actions">
                        <button type="button" className="text-link" onClick={() => fileInputRef.current?.click()}>
                          Change
                        </button>
                        <button type="button" className="text-link" onClick={removePhoto}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  // No photo yet: a box to click, or to drag a photo onto.
                  <label
                    htmlFor="guest-photo"
                    className={`dropzone${dragging ? " is-dragging" : ""}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      choosePhoto(e.dataTransfer.files?.[0]);
                    }}
                  >
                    <span className="dropzone-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="22" height="22">
                        <path d="M12 16V4M7 9l5-5 5 5M5 20h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className="dropzone-title">
                      Upload image here <span className="required-mark" aria-hidden="true">*</span>
                    </span>
                    <span className="dropzone-hint">JPG or PNG, up to {MAX_PHOTO_MB} MB</span>
                  </label>
                )}

                {/* The real file picker (hidden; the box above opens it). */}
                <input
                  ref={fileInputRef}
                  id="guest-photo"
                  className="visually-hidden"
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={(e) => choosePhoto(e.target.files?.[0])}
                />
                {photoProblem && <p className="field-error">{photoProblem}</p>}
                {!photoProblem && isMissing("photo") && <p className="field-error">Please upload a photo of the burn.</p>}
              </div>
            </section>

            {/* ===== Assess case button ===== */}
            <div className="guest-submit">
              {/* Shown if the server could not save the assessment. */}
              {saveError && (
                <p className="form-error" role="alert">
                  {saveError}
                </p>
              )}
              <button type="submit" className="button button-primary button-wide" disabled={saving}>
                {saving ? "Assessing…" : "Assess case"}
              </button>
              <p>Your answers and photo are saved securely with your report number.</p>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

/* =====================================================================
   THE REPORT (looks like a sheet of paper)
   ===================================================================== */
function Report({ report }) {
  const { id, createdAt, emergency, form, photoUrl, result, assessedBy, tbsa, bodyMap } = report;
  const decision = DECISIONS[result.decision];
  const emergencyFlag = hasEmergency(emergency);

  // The body map as it was marked, shown on the report (look only, no tapping).
  const chart = chooseChart(AGE_IN_YEARS[form.age] ?? 16);
  const marks = Object.fromEntries(
    (bodyMap?.breakdown ?? []).map(({ id, method, palms, touched }) => [id, { method, palms, touched }]),
  );

  // One row of the report: question on the left, answer on the right.
  const rows = [
    ["Patient's age", `${form.age} (${isChild(form.age) ? "child" : "adult"})`],
    ["Cause of the burn", form.cause],
    ["Goes all the way around a body part", form.circumferential],
    ["Long-term conditions", form.conditions.join(", ")],
    ["Not healed after 2 weeks", form.notHealed],
    ...(isChild(form.age) ? [["Child unwell or feverish", form.childUnwell]] : []),
  ];

  return (
    <article className="report-paper" aria-label="Burn assessment report">
      {/* ----- Header: name, title, report number and date ----- */}
      <header className="report-head">
        <div className="report-brand">
          <img src="/burncare-logo.png" alt="" className="report-logo" />
          <div>
            <p className="report-brand-name">BurnCare</p>
            <h1 className="report-title">Burn Assessment Report</h1>
          </div>
        </div>
        <dl className="report-meta">
          <div>
            <dt>Report ID</dt>
            <dd className="report-id">{id}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>
              {createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })},{" "}
              {createdAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </dd>
          </div>
          <div>
            <dt>Assessed by</dt>
            <dd>{assessedBy || "Guest"}</dd>
          </div>
        </dl>
      </header>

      {/* ----- The decision, at the top ----- */}
      <section className={`report-decision is-${result.decision}`}>
        <p className="report-decision-label">Recommendation</p>
        <h2>{decision.title}</h2>
        <p>{decision.text}</p>
        {result.reasons.length > 0 && (
          <ul className="report-reasons">
            {result.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
      </section>

      {/* ----- Emergency banner (only if the emergency check flagged it) ----- */}
      {emergencyFlag && (
        <p className="report-call">
          <strong>Call 997 now.</strong> An answer in the emergency check suggests a possible emergency.
        </p>
      )}

      {/* ----- Emergency check answers ----- */}
      <ReportSection title="Emergency check">
        <dl className="report-rows">
          {EMERGENCY_QUESTIONS.map((q) => (
            <div key={q.key}>
              <dt>{q.label}</dt>
              <dd className={EMERGENCY_ANSWERS.includes(emergency[q.key]) ? "is-flag" : ""}>{emergency[q.key]}</dd>
            </div>
          ))}
        </dl>
      </ReportSection>

      {/* ----- Case details ----- */}
      <ReportSection title="About the burn">
        <dl className="report-rows">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </ReportSection>

      {/* ----- Burn size (TBSA) ----- */}
      <ReportSection title="Burn size (TBSA)">
        <dl className="report-rows">
          <div>
            <dt>Estimated burn size</dt>
            <dd>{tbsa != null ? `${formatPercent(tbsa)}% of the body` : "—"}</dd>
          </div>
          {bodyMap && (
            <div>
              <dt>Chart used</dt>
              <dd>{bodyMap.chartLabel}</dd>
            </div>
          )}
          {bodyMap?.breakdown.map((row) => (
            <div key={row.id}>
              <dt>{row.label}</dt>
              <dd>
                {formatPercent(row.percent)}% ({row.method === "whole" ? "whole area" : `${row.palms} ${row.palms === 1 ? "palm" : "palms"}`})
              </dd>
            </div>
          ))}
        </dl>
        {bodyMap?.breakdown.length > 0 && (
          <div className="report-body-map">
            <BodyMap
              variant={isChildChart(chart) ? "child" : "adult"}
              chart={chart}
              marks={marks}
              counted
              readOnly
            />
            <p className="report-map-key">
              <span className="report-key is-whole" aria-hidden="true" /> Whole area
              <span className="report-key is-palms" aria-hidden="true" /> Part of it (palms)
            </p>
          </div>
        )}
        <p className="report-pending">
          Counts every marked area until the photo check confirms how deep the burn is.
        </p>
      </ReportSection>

      {/* ----- Burn photo ----- */}
      <ReportSection title="Burn photo">
        <div className="report-images">
          <figure>
            <img src={photoUrl} alt="Uploaded burn photo" />
            <figcaption>Uploaded photo</figcaption>
          </figure>

          {/* LATER RELEASE: the AI heatmap next to the photo.
              Remove the comment marks when the AI model is connected.
          <figure>
            <img src={report.heatmapUrl} alt="AI heatmap of the burn" />
            <figcaption>AI heatmap (supporting information only)</figcaption>
          </figure>
          */}
        </div>

        {/* LATER RELEASE: the AI burn depth estimate.
        <dl className="report-rows">
          <div>
            <dt>AI burn depth estimate</dt>
            <dd>{report.aiDepth}</dd>
          </div>
        </dl>
        */}
      </ReportSection>

      {/* ----- Disclaimer ----- */}
      <footer className="report-foot">
        BurnCare supports, but does not replace, a clinician's judgment or a burn unit consultation. Referral
        rules follow the British Burn Association referral thresholds.
      </footer>
    </article>
  );
}

// A titled section inside the report.
function ReportSection({ title, children }) {
  return (
    <section className="report-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

// The buttons under the report.
// Release 1: "Back to home" and "Start a new assessment" only.
// "Download as PDF" and "Save to my account" are kept below as comments
// for a later release.
function ReportActions({ onStartOver }) {
  /* LATER RELEASE: Download as PDF.
     Opens the browser's print window, where the user picks "Save as PDF".
     The print styles in styles.css print only the report paper.
     (Add "report" back to the props above when you turn this on.)

  const downloadPdf = () => {
    const oldTitle = document.title;
    document.title = `BurnCare-${report.id}`; // becomes the PDF file name
    window.print();
    document.title = oldTitle;
  };
  */

  /* LATER RELEASE: Save to my account.
     Keeps the answers for a moment so they can be saved after logging in.
     TODO (backend): after login, send them to the API to save the report.

  const keepForSaving = () => {
    try {
      const { photoUrl, ...data } = report; // the photo link can't be kept
      sessionStorage.setItem("burncare-pending-report", JSON.stringify(data));
    } catch {
      // Storage can be blocked (e.g. private mode); saving is then skipped.
    }
  };
  */

  return (
    <div className="report-actions">
      {/* LATER RELEASE: the two buttons below.
      <button type="button" className="button button-primary" onClick={downloadPdf}>
        Download as PDF
      </button>
      <Link className="button button-outline" to="/login" onClick={keepForSaving}>
        Save to my account
      </Link>
      */}

      {/* Go back to the home page. Guest reports are not stored. */}
      <Link className="button button-primary" to="/">
        Back to home
      </Link>

      {/* Clear the answers and start again from the emergency check. */}
      <button type="button" className="button button-outline" onClick={onStartOver}>
        Start a new assessment
      </button>

      <p className="report-actions-note">This report is not saved when you leave this page.</p>
    </div>
  );
}

/* =====================================================================
   THE "CALL 997" POP-UP
   An urgent message only — it does not place a call.
   ===================================================================== */
function CallPopup({ onClose }) {
  const closeRef = useRef(null);

  // Put keyboard focus on the pop-up, and close it with the Esc key.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // createPortal places the pop-up directly inside <body>, so it covers the
  // whole screen (including the top bar) instead of only the page area.
  return createPortal(
    <div className="call-overlay" onClick={onClose}>
      <div
        className="call-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="call-title"
        aria-describedby="call-text"
        onClick={(e) => e.stopPropagation()} // clicks inside don't close it
      >
        {/* Round coral "!" warning icon */}
        <span className="call-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28">
            <path d="M12 6v8M12 18v.01" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </span>
        <h2 id="call-title">Urgent: call 997 now</h2>
        <p id="call-text">
          Your answer suggests a possible emergency. Please call the Saudi Red Crescent on <strong>997</strong> right
          away. You can keep filling in the assessment while you wait for help.
        </p>
        {/* Closes the message and returns to the questions. */}
        <button ref={closeRef} type="button" className="button button-primary call-button" onClick={onClose}>
          I understand, continue
        </button>
      </div>
    </div>,
    document.body
  );
}

/* =====================================================================
   SMALL BUILDING BLOCKS
   ===================================================================== */

// The heading of each step: "Step X", the title, and an optional badge.
function StepHeader({ number, title, badge }) {
  return (
    <div className="guest-step-head">
      <span className="guest-step-label">Step {number}</span>
      <h2 className="guest-step-title">{title}</h2>
      {badge && <span className="soon-badge">{badge}</span>}
    </div>
  );
}

// One question box: the question text, an optional hint, the answer
// control (children), and a red "required" message when it is missing.
function Question({ id, label, hint, missing, htmlFor, appear, children }) {
  const LabelTag = htmlFor ? "label" : "span";
  return (
    <div
      id={`field-${id}`}
      className={`field${missing ? " is-missing" : ""}${appear ? " field-appear" : ""}`}
      role={htmlFor ? undefined : "group"}
      aria-labelledby={htmlFor ? undefined : `label-${id}`}
    >
      <LabelTag className="field-label" id={`label-${id}`} htmlFor={htmlFor}>
        <span>
          {label} <span className="required-mark" aria-hidden="true">*</span>
        </span>
      </LabelTag>
      {hint && <p className="field-hint">{hint}</p>}
      {children}
      {missing && <p className="field-error">This question is required.</p>}
    </div>
  );
}

// A row of answer buttons.
// variant: "segmented" (Yes/No switch) or "chips" (pills).
// multiple: several answers can be chosen (value is then a list).
function ChoiceButtons({ name, options, value, onChoose, variant, multiple }) {
  return (
    <div
      className={`choices choices-${variant}`}
      role={multiple ? "group" : "radiogroup"}
      style={variant === "segmented" ? { gridTemplateColumns: `repeat(${options.length}, 1fr)` } : undefined}
    >
      {options.map((option) => {
        const selected = multiple ? value.includes(option) : value === option;
        return (
          <button
            type="button"
            key={option}
            role={multiple ? "checkbox" : "radio"}
            aria-checked={selected}
            className={selected ? "is-selected" : ""}
            onClick={() => onChoose(name, option)}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

export default GuestPage;