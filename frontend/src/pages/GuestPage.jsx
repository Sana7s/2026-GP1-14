/* =====================================================================
   BurnCare — pages/GuestPage.jsx
   ---------------------------------------------------------------------
   The Guest assessment page (address: /guest).
   ===================================================================== */

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { prefersReducedMotion } from "../components/animations.jsx";
import { Chevron } from "../components/Chevron.jsx";

/* =====================================================================
   7. GUEST ASSESSMENT PAGE
   Lets anyone start a burn assessment without an account, in 3 steps:
     Step 1 — answer six clinical questions (all choices, no typing)
     Step 2 — mark burned areas on a body map (TBSA, coming soon)
     Step 3 — upload a photo of the burn
   Every question and the photo are REQUIRED. If something is missing,
   "Assess case" shows a pop-up naming ONE missing question at a time.
   ===================================================================== */

// Answer choices for each clinical question.
const AGE_GROUPS = [
  "Under 1 year",
  "1 – 4 years",
  "5 – 9 years",
  "10 – 14 years",
  "15 – 17 years",
  "18 – 29 years",
  "30 – 44 years",
  "45 – 59 years",
  "60 – 74 years",
  "75 years or older",
];

const BURN_CAUSES = [
  "Flame or heat",
  "Hot liquid",
  "Chemical",
  "Electrical",
  "Radiation",
  "Other",
];

const BURN_LOCATIONS = [
  "Head or neck",
  "Face",
  "Chest",
  "Abdomen",
  "Back",
  "Arm",
  "Hand",
  "Leg",
  "Foot",
  "Genital area",
  "Major joint (shoulder, elbow, knee…)",
];

const INJURY_TIMES = [
  "Less than 1 hour",
  "1 to 6 hours",
  "6 to 24 hours",
  "24 to 48 hours",
  "More than 48 hours",
];

// Pain level choices: 0, 1, 2 … 10.
const PAIN_LEVELS = Array.from({ length: 11 }, (_, i) => i);

// The list of required answers. "label" is the name shown in the
// "missing answers" pop-up; "step" tells the visitor where to look.
const REQUIRED_QUESTIONS = [
  { key: "age", label: "Age group", step: 1 },
  { key: "diabetes", label: "Diabetes", step: 1 },
  { key: "pain", label: "Pain level", step: 1 },
  { key: "cause", label: "Cause of the burn", step: 1 },
  { key: "location", label: "Location of the burn", step: 1 },
  { key: "time", label: "Time since injury", step: 1 },
  { key: "photo", label: "Burn photo", step: 3 },
];

// The empty form: nothing is chosen until the visitor picks an answer.
const EMPTY_FORM = {
  age: "",
  diabetes: "",
  pain: "",
  cause: "",
  location: "",
  time: "",
};

// Photo rules: JPG or PNG, up to 10 MB.
const PHOTO_TYPES = ["image/jpeg", "image/png"];
const MAX_PHOTO_MB = 10;

function GuestPage() {
  const [form, setForm] = useState(EMPTY_FORM); // the visitor's answers
  const [photo, setPhoto] = useState(null); // the chosen photo file
  const [photoUrl, setPhotoUrl] = useState(""); // preview link for the photo
  const [photoProblem, setPhotoProblem] = useState(""); // wrong file type/size
  const [missing, setMissing] = useState([]); // keys of unanswered questions
  const [showAlert, setShowAlert] = useState(false); // show the pop-up?
  const [submitted, setSubmitted] = useState(false); // case accepted?
  const [dragging, setDragging] = useState(false); // photo dragged over box?
  const fileInputRef = useRef(null);

  // The pop-up shows ONE missing question at a time: the first in the list.
  const current = REQUIRED_QUESTIONS.find(({ key }) => missing.includes(key));

  // Only the question shown in the pop-up is outlined in red.
  const isMissing = (key) => current?.key === key;

  // Save one answer. If it was missing, remove it from the missing list.
  const answer = (key, value) => {
    setForm((old) => ({ ...old, [key]: value }));
    setMissing((old) => old.filter((item) => item !== key));
  };

  // When every missing answer has been filled, close the pop-up.
  useEffect(() => {
    if (showAlert && missing.length === 0) setShowAlert(false);
  }, [missing, showAlert]);

  // Free the memory used by an old photo preview.
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

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
    setMissing((old) => old.filter((item) => item !== "photo"));
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
    box.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "center",
    });
    box.classList.remove("is-flashing");
    void box.offsetWidth; // restarts the shake animation
    box.classList.add("is-flashing");
  };

  // Runs when "Assess case" is pressed.
  const handleSubmit = (event) => {
    event.preventDefault(); // stop the page from reloading

    // Make the list of everything not answered yet (in page order).
    const notAnswered = REQUIRED_QUESTIONS.filter(({ key }) =>
      key === "photo" ? !photo : form[key] === ""
    ).map(({ key }) => key);

    // Something is missing: show the pop-up and go to the first one.
    if (notAnswered.length) {
      setMissing(notAnswered);
      setShowAlert(true);
      goToQuestion(notAnswered[0]);
      return;
    }

    // Everything is answered — the case can be assessed.
    // TODO (backend): send `form` and `photo` to the Flask API here, then
    // show the AI result (burn depth, urgency, confidence and heatmap).
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };

  // Clear everything so the visitor can start a new case.
  const startOver = () => {
    setForm(EMPTY_FORM);
    setMissing([]);
    setShowAlert(false);
    removePhoto();
    setPhotoProblem("");
    setSubmitted(false);
  };

  // ---------- After a complete submission: confirmation screen ----------
  if (submitted) {
    return (
      <section className="guest-page">
        <div className="guest-done">
          <span className="guest-done-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28">
              <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <h1>Your case details are complete.</h1>
          <p className="guest-done-text">
            The AI assessment will appear here once the BurnCare model is
            connected. If the burn is severe or you are worried, contact a
            healthcare professional now.
          </p>

          {/* A short summary of the visitor's answers. */}
          <dl className="guest-summary">
            <div><dt>Age group</dt><dd>{form.age}</dd></div>
            <div><dt>Diabetes</dt><dd>{form.diabetes}</dd></div>
            <div><dt>Pain level</dt><dd>{form.pain} / 10</dd></div>
            <div><dt>Cause</dt><dd>{form.cause}</dd></div>
            <div><dt>Location</dt><dd>{form.location}</dd></div>
            <div><dt>Time since injury</dt><dd>{form.time}</dd></div>
          </dl>

          <div className="hero-actions">
            <button type="button" className="button button-primary" onClick={startOver}>
              Start a new case
            </button>
            <Link className="text-link" to="/register">
              Create an account to save reports <Chevron />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // ---------- The assessment form ----------
  return (
    <section className="guest-page">
      {/* ===== Pop-up: shows the next missing question (one at a time) ===== */}
      {showAlert && current && (
        <div className="missing-alert" role="alert" key={current.key}>
          <span className="missing-alert-icon" aria-hidden="true">!</span>
          <div className="missing-alert-body">
            <p className="missing-alert-title">Required question not answered</p>
            <p className="missing-alert-text">
              Please answer <strong>{current.label}</strong> in Step {current.step}{" "}
              before assessing the case.
            </p>
            <button
              type="button"
              className="missing-alert-go"
              onClick={() => goToQuestion(current.key)}
            >
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

      <div className="guest-container">
        {/* ===== Page title (left) + emergency notice (right) ===== */}
        <header className="guest-header">
          <div>
            <h1>Guest Assessment</h1>
            <p className="guest-subtitle">Assess a burn in three steps.</p>
          </div>

          {/* Emergency notice: always visible at the top of the page. */}
          <aside className="emergency-note" aria-label="Emergency information">
            <span className="emergency-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M12 3l9.5 17h-19L12 3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M12 10v4.5M12 17.5v.01" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <p>
              <strong>In an emergency</strong>
              If the burn is large, deep, on the face, or caused by electricity
              or chemicals, seek medical care right away.
            </p>
          </aside>
        </header>

        {/* noValidate: we show our own friendly messages instead of the browser's. */}
        <form onSubmit={handleSubmit} noValidate>
          {/* ===== STEP 1: clinical questions ===== */}
          <section className="guest-step">
            <StepHeader number={1} title="Clinical details" />

            <div className="field-grid">
              {/* Age group — drop-down list */}
              <Question id="age" label="Age group" missing={isMissing("age")} htmlFor="guest-age">
                <select
                  id="guest-age"
                  value={form.age}
                  onChange={(e) => answer("age", e.target.value)}
                  aria-invalid={isMissing("age")}
                >
                  <option value="" disabled hidden>Choose an age group</option>
                  {AGE_GROUPS.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </Question>

              {/* Diabetes — Yes / No */}
              <Question id="diabetes" label="Do you have diabetes?" missing={isMissing("diabetes")}>
                <ChoiceButtons
                  name="diabetes"
                  options={["Yes", "No"]}
                  value={form.diabetes}
                  onChoose={answer}
                  variant="segmented"
                />
              </Question>

              {/* Location — drop-down list */}
              <Question id="location" label="Where is the burn?" missing={isMissing("location")} htmlFor="guest-location">
                <select
                  id="guest-location"
                  value={form.location}
                  onChange={(e) => answer("location", e.target.value)}
                  aria-invalid={isMissing("location")}
                >
                  <option value="" disabled hidden>Choose a body area</option>
                  {BURN_LOCATIONS.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </Question>

              {/* Time since injury — drop-down list */}
              <Question id="time" label="When did it happen?" missing={isMissing("time")} htmlFor="guest-time">
                <select
                  id="guest-time"
                  value={form.time}
                  onChange={(e) => answer("time", e.target.value)}
                  aria-invalid={isMissing("time")}
                >
                  <option value="" disabled hidden>Choose a time</option>
                  {INJURY_TIMES.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </Question>

              {/* Cause of the burn — choice buttons */}
              <Question id="cause" label="What caused the burn?" missing={isMissing("cause")} wide>
                <ChoiceButtons
                  name="cause"
                  options={BURN_CAUSES}
                  value={form.cause}
                  onChoose={answer}
                  variant="chips"
                />
              </Question>

              {/* Pain level — buttons from 0 to 10 */}
              <Question id="pain" label="Pain level" missing={isMissing("pain")} wide>
                <ChoiceButtons
                  name="pain"
                  options={PAIN_LEVELS}
                  value={form.pain}
                  onChoose={answer}
                  variant="scale"
                />
                <div className="pain-scale" aria-hidden="true">
                  <span>No pain</span>
                  <span>Worst pain</span>
                </div>
              </Question>
            </div>
          </section>

          {/* ===== STEP 2: TBSA body map (placeholder for now) ===== */}
          <section className="guest-step">
            <StepHeader number={2} title="Body map (TBSA)" badge="Coming soon" />
            {/* PLACEHOLDER: the interactive TBSA body map will go here. */}
            <div className="tbsa-placeholder" aria-hidden="true">
              <BodyOutline />
              <BodyOutline />
              <p>Front and back body map</p>
            </div>
          </section>

          {/* ===== STEP 3: photo upload ===== */}
          <section className="guest-step">
            <StepHeader number={3} title="Burn photo" />

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
                  <span className="dropzone-title">Upload image here</span>
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
              {!photoProblem && isMissing("photo") && (
                <p className="field-error">Please upload a photo of the burn.</p>
              )}
            </div>
          </section>

          {/* ===== Assess case button ===== */}
          <div className="guest-submit">
            <button type="submit" className="button button-primary button-wide">
              Assess case
            </button>
            <p>Guest submissions are processed without being stored.</p>
          </div>
        </form>
      </div>
    </section>
  );
}

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

// One question box: the question text, the answer control (children),
// and a red "required" message when it is missing.
function Question({ id, label, missing, wide, htmlFor, children }) {
  const LabelTag = htmlFor ? "label" : "span";
  return (
    <div
      id={`field-${id}`}
      className={`field${wide ? " field-wide" : ""}${missing ? " is-missing" : ""}`}
      role={htmlFor ? undefined : "group"}
      aria-labelledby={htmlFor ? undefined : `label-${id}`}
    >
      <LabelTag className="field-label" id={`label-${id}`} htmlFor={htmlFor}>
        {label} <span className="required-mark" aria-hidden="true">*</span>
      </LabelTag>
      {children}
      {missing && <p className="field-error">This question is required.</p>}
    </div>
  );
}

// A row of answer buttons where only one can be chosen.
// variant: "segmented" (Yes/No switch), "scale" (0–10), or "chips" (pills).
function ChoiceButtons({ name, options, value, onChoose, variant }) {
  return (
    <div className={`choices choices-${variant}`} role="radiogroup">
      {options.map((option) => {
        const selected = value === option;
        return (
          <button
            type="button"
            key={option}
            role="radio"
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

// A simple body outline used in the TBSA placeholder.
function BodyOutline() {
  return (
    <svg viewBox="0 0 120 200" className="tbsa-figure">
      <circle cx="60" cy="22" r="14" />
      <rect x="40" y="40" width="40" height="66" rx="14" />
      <rect x="20" y="44" width="14" height="62" rx="7" />
      <rect x="86" y="44" width="14" height="62" rx="7" />
      <rect x="42" y="108" width="15" height="78" rx="7" />
      <rect x="63" y="108" width="15" height="78" rx="7" />
    </svg>
  );
}

export default GuestPage;
