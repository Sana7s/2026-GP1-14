/* =====================================================================
   BurnCare — pages/PatientEntry.jsx
   Patient assessment flow aligned with BBA criteria & styles.css
   ---------------------------------------------------------------------
   Saving: the answers, the body map and the photo are sent to Flask
   (POST /api/assessments). The SERVER works out the burn size again
   (tbsa.py) and the result with the BBA rules (referral.py), and saves
   them in the database, so the result can be trusted and shows up on
   the homepage and in My reports.
   Step 2 is the TBSA calculator (components/TbsaCalculator.jsx).
   ===================================================================== */

import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { prefersReducedMotion } from "../components/animations.jsx";
import { Chevron } from "../components/Chevron.jsx";
import TbsaCalculator from "../components/TbsaCalculator.jsx";

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

const ADULT = "16 years or older";
const AGE_GROUPS = [
  "Under 1 year",
  "1 – 4 years",
  "5 – 9 years",
  "10 – 14 years",
  "15 years",
  ADULT,
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

const PHOTO_TYPES = ["image/jpeg", "image/png"];
const MAX_PHOTO_MB = 10;

const EMPTY_EMERGENCY = { breathing: "", smoke: "", responsive: "" };
const EMPTY_FORM = {
  age: "",
  cause: "",
  circumferential: "",
  conditions: [],
  notHealed: "",
  childUnwell: "",
};

const isChild = (age) => age !== "" && age !== ADULT;

// The TBSA calculator needs an age in years to choose its chart. Each age
// group → the youngest age in it (same chart for the whole group).
const AGE_IN_YEARS = {
  "Under 1 year": 0,
  "1 – 4 years": 1,
  "5 – 9 years": 5,
  "10 – 14 years": 10,
  "15 years": 15,
  [ADULT]: 16,
};

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
    text: "This burn only needs first aid at home. Watch for warning signs.",
  },
  // No warning sign in the answers, but the final result also needs the
  // burn size (body map) and the photo check, which aren't connected yet.
  pending: {
    title: "Result pending",
    text: "Your answers show no urgent warning sign. The final result needs the burn size and photo check. If the burn gets worse or you are worried, see a doctor.",
  },
};

function PatientEntry() {
  const [screen, setScreen] = useState("emergency");
  const [slide, setSlide] = useState("");
  const [emergency, setEmergency] = useState(EMPTY_EMERGENCY);
  const [form, setForm] = useState(EMPTY_FORM);
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoProblem, setPhotoProblem] = useState("");
  const [missing, setMissing] = useState([]);
  const [showAlert, setShowAlert] = useState(false);
  const [report, setReport] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false); // waiting for Flask?
  const [saveProblem, setSaveProblem] = useState(""); // message if saving failed
  const [tbsa, setTbsa] = useState(null); // latest result from the body map
  const [mapKey, setMapKey] = useState(0); // change it to clear the body map
  const fileInputRef = useRef(null);

  const child = isChild(form.age);

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
          ...(child ? [{ key: "childUnwell", label: "Child unwell or feverish", answered: form.childUnwell !== "" }] : []),
          { key: "tbsa", label: "Burned areas on the body map", answered: Boolean(tbsa?.breakdown.length) },
          { key: "photo", label: "Burn photo", answered: Boolean(photo) },
        ];

  const current = required.find(({ key }) => missing.includes(key));
  const isMissing = (key) => current?.key === key;

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const clearMissing = (key) => setMissing((old) => old.filter((item) => item !== key));

  const answerEmergency = (key, value) => {
    setEmergency((old) => ({ ...old, [key]: value }));
    clearMissing(key);
  };

  const answer = (key, value) => {
    setForm((old) => ({ ...old, [key]: value }));
    clearMissing(key);
  };

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

  const goToQuestion = (key) => {
    const box = document.getElementById(`field-${key}`);
    if (!box) return;
    box.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
    box.classList.remove("is-flashing");
    void box.offsetWidth;
    box.classList.add("is-flashing");
  };

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

  const handleNext = () => {
    if (checkScreen()) {
      setSlide("slide-forward");
      setScreen("form");
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
  };

  // Send the answers + photo to Flask, which decides and saves the result.
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving || !checkScreen()) return;

    // A "multipart form": the answers as JSON text, plus the photo file.
    const body = new FormData();
    // Body map: only WHICH areas and how much (the server adds them up again).
    const bodyMap = tbsa.breakdown.map(({ id, method, palms, touched }) => ({ id, method, palms, touched }));
    body.append("data", JSON.stringify({ emergency, form, bodyMap }));
    body.append("photo", photo);

    setSaving(true);
    setSaveProblem("");
    try {
      let response;
      try {
        response = await fetch("/api/assessments", { method: "POST", body, credentials: "same-origin" });
      } catch {
        throw new Error("Cannot reach the BurnCare server. Please check your connection and try again.");
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The assessment could not be saved. Please try again.");

      setReport(data.report); // the saved report, with the server's result
      setScreen("report");
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    } catch (error) {
      setSaveProblem(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (screen === "report" && report) {
    const decision = DECISIONS[report.result.decision] || DECISIONS["local"];
    return (
      <section className="guest-page">
        <div className="guest-container report-container slide-forward">
          <article className="report-paper">
            <header className="report-head">
              <div className="report-brand">
                <img src="/burncare-logo.png" alt="" className="report-logo" />
                <div>
                  <p className="report-brand-name">BurnCare</p>
                  <h1 className="report-title">Patient Assessment Report</h1>
                </div>
              </div>
              <dl className="report-meta">
                <div><dt>Report ID</dt><dd className="report-id">{report.id}</dd></div>
                <div><dt>Date</dt><dd>{new Date(report.createdAt).toLocaleDateString()}</dd></div>
                <div><dt>Status</dt><dd>Saved to Account</dd></div>
                {report.tbsa != null && (
                  <div><dt>Burn size (TBSA)</dt><dd>{report.tbsa}%</dd></div>
                )}
              </dl>
            </header>

            <section className={`report-decision is-${report.result.decision}`}>
              <p className="report-decision-label">Recommendation</p>
              <h2>{decision.title}</h2>
              <p>{decision.text}</p>
              {report.result.reasons?.length > 0 && (
                <ul className="report-reasons">
                  {report.result.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
            </section>

            <div className="report-actions" style={{ marginTop: "32px" }}>
              <Link className="button button-primary" to="/patient/reports">
                View in Assessment History
              </Link>
              <button
                type="button"
                className="button button-outline"
                onClick={() => {
                  setEmergency(EMPTY_EMERGENCY);
                  setForm(EMPTY_FORM);
                  removePhoto();
                  setReport(null);
                  setTbsa(null);
                  setMapKey((key) => key + 1); // a fresh, empty body map
                  setScreen("emergency");
                }}
              >
                Assess Another Case
              </button>
            </div>
          </article>
        </div>
      </section>
    );
  }

  return (
    <section className="guest-page">
      {showAlert && current && (
        <div className="missing-alert" role="alert" key={current.key}>
          <span className="missing-alert-icon" aria-hidden="true">!</span>
          <div className="missing-alert-body">
            <p className="missing-alert-title">Required question not answered</p>
            <p className="missing-alert-text">
              Please answer <strong>{current.label}</strong> before continuing.
            </p>
            <button type="button" className="missing-alert-go" onClick={() => goToQuestion(current.key)}>
              Go to question <Chevron />
            </button>
          </div>
          <button type="button" className="missing-alert-close" onClick={() => setShowAlert(false)}>×</button>
        </div>
      )}

      <div className="guest-container">
        <header className="guest-header">
          <div>
            <h1>Patient Assessment</h1>
            <p className="guest-subtitle">
              {screen === "emergency" ? "Part 1 of 2 · Emergency check" : "Part 2 of 2 · Burn details"}
            </p>
          </div>
          <aside className="emergency-note">
            <span className="emergency-icon">!</span>
            <p><strong>In an emergency</strong> Call 997 immediately if the patient shows critical distress.</p>
          </aside>
        </header>

        {screen === "emergency" ? (
          <div className={`guest-panel ${slide}`}>
            <section className="guest-step">
              <div className="guest-step-head">
                <span className="guest-step-label">Before you start</span>
                <h2 className="guest-step-title">Three quick safety questions</h2>
              </div>
              <div className="field-grid">
                {EMERGENCY_QUESTIONS.map((q) => (
                  <div key={q.key} id={`field-${q.key}`} className={`field${isMissing(q.key) ? " is-missing" : ""}`}>
                    <span className="field-label">{q.label} <span className="required-mark">*</span></span>
                    <div className="choices choices-segmented" style={{ gridTemplateColumns: `repeat(${q.options.length}, 1fr)` }}>
                      {q.options.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          className={emergency[q.key] === opt ? "is-selected" : ""}
                          onClick={() => answerEmergency(q.key, opt)}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <div className="guest-submit">
              <button type="button" className="button button-primary button-wide" onClick={handleNext}>
                Next <Chevron />
              </button>
            </div>
          </div>
        ) : (
          <form className={`guest-panel ${slide}`} onSubmit={handleSubmit} noValidate>
            <section className="guest-step">
              <div className="guest-step-head guest-step-head-row">
                <div>
                  <span className="guest-step-label">Step 1</span>
                  <h2 className="guest-step-title">About the burn</h2>
                </div>
                <button type="button" className="back-button" onClick={() => setScreen("emergency")}>
                  Back
                </button>
              </div>

              <div className="field-grid">
                <div id="field-age" className={`field${isMissing("age") ? " is-missing" : ""}`}>
                  <span className="field-label">How old is the patient? <span className="required-mark">*</span></span>
                  <div className="choices choices-chips">
                    {AGE_GROUPS.map((opt) => (
                      <button key={opt} type="button" className={form.age === opt ? "is-selected" : ""} onClick={() => answer("age", opt)}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div id="field-cause" className={`field${isMissing("cause") ? " is-missing" : ""}`}>
                  <span className="field-label">What caused the burn? <span className="required-mark">*</span></span>
                  <div className="choices choices-chips">
                    {BURN_CAUSES.map((opt) => (
                      <button key={opt} type="button" className={form.cause === opt ? "is-selected" : ""} onClick={() => answer("cause", opt)}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div id="field-circumferential" className={`field${isMissing("circumferential") ? " is-missing" : ""}`}>
                  <span className="field-label">Does the burn go all the way around a limb, neck or chest? <span className="required-mark">*</span></span>
                  <div className="choices choices-segmented" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                    {["Yes", "No", "Not sure"].map((opt) => (
                      <button key={opt} type="button" className={form.circumferential === opt ? "is-selected" : ""} onClick={() => answer("circumferential", opt)}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div id="field-conditions" className={`field${isMissing("conditions") ? " is-missing" : ""}`}>
                  <span className="field-label">Long-term conditions? <span className="required-mark">*</span></span>
                  <div className="choices choices-chips">
                    {CONDITIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className={form.conditions.includes(opt) ? "is-selected" : ""}
                        onClick={() => toggleCondition(null, opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div id="field-notHealed" className={`field${isMissing("notHealed") ? " is-missing" : ""}`}>
                  <span className="field-label">Has the burn lasted over 2 weeks without healing? <span className="required-mark">*</span></span>
                  <div className="choices choices-segmented" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                    {["Yes", "No"].map((opt) => (
                      <button key={opt} type="button" className={form.notHealed === opt ? "is-selected" : ""} onClick={() => answer("notHealed", opt)}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {child && (
                  <div id="field-childUnwell" className={`field${isMissing("childUnwell") ? " is-missing" : ""}`}>
                    <span className="field-label">Does the child seem unwell or feverish? <span className="required-mark">*</span></span>
                    <div className="choices choices-segmented" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                      {["Yes", "No", "Not sure"].map((opt) => (
                        <button key={opt} type="button" className={form.childUnwell === opt ? "is-selected" : ""} onClick={() => answer("childUnwell", opt)}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="guest-step">
              <div className="guest-step-head">
                <span className="guest-step-label">Step 2</span>
                <h2 className="guest-step-title">Where is the burn?</h2>
              </div>
              <div id="field-tbsa" className={`field${isMissing("tbsa") ? " is-missing" : ""}`}>
                <TbsaCalculator
                  key={mapKey}
                  age={form.age ? AGE_IN_YEARS[form.age] : null}
                  depth={null} // TODO (AI): the burn depth from the photo check
                  onChange={setTbsa}
                />
              </div>
            </section>

            <section className="guest-step">
              <div className="guest-step-head">
                <span className="guest-step-label">Step 3</span>
                <h2 className="guest-step-title">Burn photo</h2>
              </div>
              <div id="field-photo" className={`field${isMissing("photo") ? " is-missing" : ""}`}>
                {photoUrl ? (
                  <div className="photo-preview">
                    <img src={photoUrl} alt="Preview" />
                    <div className="photo-preview-bar">
                      <span className="photo-name">{photo?.name}</span>
                      <button type="button" className="text-link" onClick={removePhoto}>Remove</button>
                    </div>
                  </div>
                ) : (
                  <label
                    htmlFor="pat-photo"
                    className={`dropzone${dragging ? " is-dragging" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setDragging(false); choosePhoto(e.dataTransfer.files?.[0]); }}
                  >
                    <span className="dropzone-title">Upload burn photo</span>
                    <span className="dropzone-hint">JPG or PNG, up to {MAX_PHOTO_MB} MB</span>
                  </label>
                )}
                <input
                  ref={fileInputRef}
                  id="pat-photo"
                  className="visually-hidden"
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={(e) => choosePhoto(e.target.files?.[0])}
                />
                {photoProblem && <p className="field-error">{photoProblem}</p>}
              </div>
            </section>

            <div className="guest-submit">
              {saveProblem && (
                <p className="field-error" role="alert">
                  {saveProblem}
                </p>
              )}
              <button type="submit" className="button button-primary button-wide" disabled={saving}>
                {saving ? "Saving…" : "Save & Assess Case"}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

export default PatientEntry;