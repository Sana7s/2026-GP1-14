/* =====================================================================
   BurnCare — pages/staff/StaffAssessmentPage.jsx
   ---------------------------------------------------------------------
   New assessment for healthcare staff (/staff/assessment). The SAME
   questions, body map (TBSA calculator) and photo as the patient and
   guest assessments, plus the clinical details staff record:
     Step 1  Patient (clinical details)
     Step 2  Emergency check
     Step 3  About the burn
     Step 4  Where is the burn? (body map)
     Step 5  Burn photo
   Saving:
     1. POST /api/assessments — Flask works out the burn size and the BBA
        result and saves the report (the same as for patients).
     2. PUT /api/staff/reports/<Report ID>/clinical — the clinical details.
   Then the report opens (/staff/reports/<Report ID>).
   Styles: the assessment styles (section 7) + "14. HEALTHCARE STAFF PAGES".
   ===================================================================== */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { prefersReducedMotion } from "../../components/animations.jsx";
import ClinicalFields from "../../components/ClinicalFields.jsx";
import TbsaCalculator from "../../components/TbsaCalculator.jsx";
import {
  AGE_GROUPS,
  AGE_IN_YEARS,
  BURN_CAUSES,
  CONDITIONS,
  EMERGENCY_QUESTIONS,
  RISKY_ANSWERS,
  isChild,
} from "../../assessmentOptions.js";
import { EMPTY_CLINICAL, clinicalProblem } from "../../staffData.js";

const PHOTO_TYPES = ["image/jpeg", "image/png"];
const MAX_PHOTO_MB = 10;
const EMPTY_EMERGENCY = { breathing: "", smoke: "", responsive: "" };
const EMPTY_FORM = { age: "", cause: "", circumferential: "", conditions: [], notHealed: "", childUnwell: "" };

function StaffAssessmentPage() {
  const navigate = useNavigate();
  const [clinical, setClinical] = useState(EMPTY_CLINICAL);
  const [emergency, setEmergency] = useState(EMPTY_EMERGENCY);
  const [form, setForm] = useState(EMPTY_FORM);
  const [tbsa, setTbsa] = useState(null); // latest result from the body map
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const [problem, setProblem] = useState(null); // { key, message } — the first missing answer
  const [saving, setSaving] = useState(false);
  const [saveProblem, setSaveProblem] = useState("");
  const fileInputRef = useRef(null);
  const child = isChild(form.age);

  // Free the memory used by an old photo preview.
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const clear = (key) => setProblem((old) => (old?.key === key ? null : old));
  // The body map's result (a stable function, so the map doesn't re-send it on every render).
  const onMapChange = useCallback((result) => {
    setTbsa(result);
    if (result?.breakdown.length) setProblem((old) => (old?.key === "tbsa" ? null : old));
  }, []);
  const setClinicalField = (key, value) => {
    setClinical((old) => ({ ...old, [key]: value }));
    clear(key);
  };
  const answerEmergency = (key, value) => {
    setEmergency((old) => ({ ...old, [key]: value }));
    clear(key);
  };
  const answer = (key, value) => {
    setForm((old) => ({ ...old, [key]: value }));
    clear(key);
  };
  const toggleCondition = (option) => {
    setForm((old) => {
      let list;
      if (option === "None") list = old.conditions.includes("None") ? [] : ["None"];
      else if (old.conditions.includes(option)) list = old.conditions.filter((c) => c !== option);
      else list = [...old.conditions.filter((c) => c !== "None"), option];
      return { ...old, conditions: list };
    });
    clear("conditions");
  };

  const choosePhoto = (file) => {
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) return setProblem({ key: "photo", message: "Please choose a JPG or PNG image." });
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      return setProblem({ key: "photo", message: `This photo is too large. Please choose one under ${MAX_PHOTO_MB} MB.` });
    }
    setPhoto(file);
    setPhotoUrl(URL.createObjectURL(file));
    clear("photo");
  };
  const removePhoto = () => {
    setPhoto(null);
    setPhotoUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // The first unanswered question, in the order of the page.
  const findProblem = () => {
    const fromClinical = clinicalProblem(clinical);
    if (fromClinical) return { ...fromClinical, scrollTo: `field-new-clinical-${fromClinical.key}` };
    const missing = [
      ...EMERGENCY_QUESTIONS.map((q, i) => [q.key, !emergency[q.key], `Please answer emergency question ${i + 1}.`]),
      ["age", !form.age, "Please choose the patient's age."],
      ["cause", !form.cause, "Please choose what caused the burn."],
      ["circumferential", !form.circumferential, "Please answer whether the burn goes all the way around."],
      ["conditions", form.conditions.length === 0, "Please choose the long-term conditions (or None)."],
      ["notHealed", !form.notHealed, "Please answer whether the burn has healed."],
      ["childUnwell", child && !form.childUnwell, "Please answer whether the child seems unwell."],
      ["tbsa", !tbsa?.breakdown.length, "Please mark the burned areas on the body map."],
      ["photo", !photo, "Please add a photo of the burn."],
    ].find(([, isMissing]) => isMissing);
    return missing ? { key: missing[0], message: missing[2], scrollTo: `field-${missing[0]}` } : null;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    const found = findProblem();
    if (found) {
      setProblem(found);
      const box = document.getElementById(found.scrollTo);
      box?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
      box?.classList.remove("is-flashing");
      void box?.offsetWidth; // restarts the shake animation
      box?.classList.add("is-flashing");
      return;
    }

    // 1. The assessment itself (the same request as the patient page).
    const body = new FormData();
    const bodyMap = tbsa.breakdown.map(({ id, method, palms, touched }) => ({ id, method, palms, touched }));
    body.append("data", JSON.stringify({ emergency, form, bodyMap }));
    body.append("photo", photo);

    setSaving(true);
    setSaveProblem("");
    let report;
    try {
      let response;
      try {
        response = await fetch("/api/assessments", { method: "POST", body, credentials: "same-origin" });
      } catch {
        throw new Error("Cannot reach the BurnCare server. Please check your connection and try again.");
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The assessment could not be saved. Please try again.");
      report = data.report;
    } catch (error) {
      setSaveProblem(error.message);
      setSaving(false);
      return;
    }

    // 2. The clinical details. If this part fails, the report is still
    //    saved, and the details can be added on the report page.
    let notice = "Assessment saved. BurnCare worked out the burn size and the referral result.";
    try {
      const response = await fetch(`/api/staff/reports/${encodeURIComponent(report.id)}/clinical`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clinical),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        notice = `The assessment is saved, but the clinical details were not: ${data.error || "please add them below."}`;
      }
    } catch {
      notice = "The assessment is saved, but the clinical details were not. Please add them below.";
    }
    navigate(`/staff/reports/${report.id}`, { state: { notice } });
  };

  const missingClass = (key) => (problem?.key === key ? " is-missing" : "");
  const error = (key) => problem?.key === key && <p className="field-error">{problem.message}</p>;

  return (
    <section className="guest-page">
      <div className="guest-container">
        <header className="guest-header">
          <div>
            <h1>New assessment</h1>
            <p className="guest-subtitle">Healthcare staff · All questions marked * are required</p>
          </div>
          <aside className="emergency-note">
            <span className="emergency-icon" aria-hidden="true">
              !
            </span>
            <p>
              <strong>In an emergency</strong> Call <span className="emergency-number">997</span> right away.
            </p>
          </aside>
        </header>

        <form className="guest-panel" onSubmit={handleSubmit} noValidate>
          {/* ===== STEP 1: Patient ===== */}
          <section className="guest-step">
            <StepHead number={1} title="Patient" />
            <ClinicalFields idPrefix="new-clinical" value={clinical} onChange={setClinicalField} problem={problem} />
          </section>

          {/* ===== STEP 2: Emergency check ===== */}
          <section className="guest-step">
            <StepHead number={2} title="Emergency check" />
            <div className="field-grid">
              {EMERGENCY_QUESTIONS.map((q) => (
                <div key={q.key} id={`field-${q.key}`} className={`field${missingClass(q.key)}`}>
                  <span className="field-label">
                    {q.label} <span className="required-mark">*</span>
                  </span>
                  <Choices
                    options={q.options}
                    value={emergency[q.key]}
                    onChoose={(value) => answerEmergency(q.key, value)}
                    segmented
                  />
                  {error(q.key)}
                </div>
              ))}
            </div>
            {Object.values(emergency).some((value) => RISKY_ANSWERS.includes(value)) && (
              <p className="report-call staff-call">
                <strong>Possible emergency.</strong> Follow your emergency protocol and call 997 if needed.
              </p>
            )}
          </section>

          {/* ===== STEP 3: About the burn ===== */}
          <section className="guest-step">
            <StepHead number={3} title="About the burn" />
            <div className="field-grid">
              <Question id="age" label="Patient's age" missing={missingClass("age")} error={error("age")}>
                <Choices options={AGE_GROUPS} value={form.age} onChoose={(value) => answer("age", value)} />
              </Question>
              <Question id="cause" label="Cause of the burn" missing={missingClass("cause")} error={error("cause")}>
                <Choices options={BURN_CAUSES} value={form.cause} onChoose={(value) => answer("cause", value)} />
              </Question>
              <Question
                id="circumferential"
                label="Does the burn go all the way around a limb, neck or chest?"
                missing={missingClass("circumferential")}
                error={error("circumferential")}
              >
                <Choices
                  options={["Yes", "No", "Not sure"]}
                  value={form.circumferential}
                  onChoose={(value) => answer("circumferential", value)}
                  segmented
                />
              </Question>
              <Question id="conditions" label="Long-term conditions" missing={missingClass("conditions")} error={error("conditions")}>
                <Choices options={CONDITIONS} value={form.conditions} onChoose={toggleCondition} multiple />
              </Question>
              <Question
                id="notHealed"
                label="Has the burn lasted over 2 weeks without healing?"
                missing={missingClass("notHealed")}
                error={error("notHealed")}
              >
                <Choices options={["Yes", "No"]} value={form.notHealed} onChoose={(value) => answer("notHealed", value)} segmented />
              </Question>
              {child && (
                <Question
                  id="childUnwell"
                  label="Does the child seem unwell or feverish?"
                  missing={missingClass("childUnwell")}
                  error={error("childUnwell")}
                >
                  <Choices
                    options={["Yes", "No", "Not sure"]}
                    value={form.childUnwell}
                    onChoose={(value) => answer("childUnwell", value)}
                    segmented
                  />
                </Question>
              )}
            </div>
          </section>

          {/* ===== STEP 4: Body map ===== */}
          <section className="guest-step">
            <StepHead number={4} title="Where is the burn?" />
            <div id="field-tbsa" className={`field${missingClass("tbsa")}`}>
              <TbsaCalculator
                age={form.age ? AGE_IN_YEARS[form.age] : null}
                depth={null} // TODO (AI): the burn depth from the photo check
                onChange={onMapChange}
              />
              {error("tbsa")}
            </div>
          </section>

          {/* ===== STEP 5: Photo ===== */}
          <section className="guest-step">
            <StepHead number={5} title="Burn photo" />
            <p className="guest-step-note">
              Take the photo from above, about 30–50 cm away, in good light, after cooling and before any cream.
            </p>
            <div id="field-photo" className={`field${missingClass("photo")}`}>
              {photoUrl ? (
                <div className="photo-preview">
                  <img src={photoUrl} alt="The burn photo to upload" />
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
                <label
                  htmlFor="staff-photo"
                  className={`dropzone${dragging ? " is-dragging" : ""}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    choosePhoto(event.dataTransfer.files?.[0]);
                  }}
                >
                  <span className="dropzone-title">
                    Upload burn photo <span className="required-mark">*</span>
                  </span>
                  <span className="dropzone-hint">JPG or PNG, up to {MAX_PHOTO_MB} MB</span>
                </label>
              )}
              <input
                ref={fileInputRef}
                id="staff-photo"
                className="visually-hidden"
                type="file"
                accept="image/jpeg,image/png"
                onChange={(event) => choosePhoto(event.target.files?.[0])}
              />
              {error("photo")}
            </div>
          </section>

          <div className="guest-submit">
            {problem && (
              <p className="field-error" role="alert">
                {problem.message}
              </p>
            )}
            {saveProblem && (
              <p className="field-error" role="alert">
                {saveProblem}
              </p>
            )}
            <button type="submit" className="button button-primary button-wide" disabled={saving}>
              {saving ? "Saving…" : "Save assessment"}
            </button>
            <p>BurnCare works out the burn size and the BBA referral result. You can review it on the next page.</p>
          </div>
        </form>
      </div>
    </section>
  );
}

function StepHead({ number, title }) {
  return (
    <div className="guest-step-head">
      <span className="guest-step-label">Step {number}</span>
      <h2 className="guest-step-title">{title}</h2>
    </div>
  );
}

function Question({ id, label, missing, error, children }) {
  return (
    <div id={`field-${id}`} className={`field${missing}`} role="group" aria-labelledby={`label-${id}`}>
      <span className="field-label" id={`label-${id}`}>
        {label} <span className="required-mark">*</span>
      </span>
      {children}
      {error}
    </div>
  );
}

// A row of answer buttons: chips (default) or a Yes/No switch (segmented).
function Choices({ options, value, onChoose, segmented, multiple }) {
  return (
    <div
      className={`choices ${segmented ? "choices-segmented" : "choices-chips"}`}
      role={multiple ? "group" : "radiogroup"}
      style={segmented ? { gridTemplateColumns: `repeat(${options.length}, 1fr)` } : undefined}
    >
      {options.map((option) => {
        const selected = multiple ? value.includes(option) : value === option;
        return (
          <button
            key={option}
            type="button"
            role={multiple ? "checkbox" : "radio"}
            aria-checked={selected}
            className={selected ? "is-selected" : ""}
            onClick={() => onChoose(option)}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

export default StaffAssessmentPage;