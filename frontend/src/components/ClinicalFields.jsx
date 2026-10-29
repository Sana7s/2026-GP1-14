/* =====================================================================
   BurnCare — components/ClinicalFields.jsx
   ---------------------------------------------------------------------
   The clinical details healthcare staff record about a patient's burn:
   hospital file number (optional), date of injury, pain level (0–10), time since
   injury, diabetes status, medical history and clinical notes.
   (Pain, time since injury and diabetes are three of the six inputs the
   AI model will use.)
   Used on the staff New assessment page and on the staff report page.

   Props:
     value      the details (see EMPTY_CLINICAL in staffData.js)
     onChange   (key, newValue) => …
     problem    { key, message } of the first problem, or null
     idPrefix   makes the box ids unique on the page
   Styles: "14. HEALTHCARE STAFF PAGES" in styles.css.
   ===================================================================== */

import { DIABETES, PAIN_LEVELS, TIME_SINCE, today } from "../staffData.js";

function ClinicalFields({ value, onChange, problem, idPrefix = "clinical" }) {
  const id = (key) => `${idPrefix}-${key}`;
  const isMissing = (key) => problem?.key === key;
  const error = (key) => isMissing(key) && <p className="field-error">{problem.message}</p>;

  return (
    <div className="field-grid staff-clinical-grid">
      <div id={`field-${id("patientRef")}`} className={`field${isMissing("patientRef") ? " is-missing" : ""}`}>
        <label className="field-label" htmlFor={id("patientRef")}>
          Hospital file number <span className="optional-mark">Optional</span>
        </label>
        <p className="field-hint">
          Only if your hospital uses one. BurnCare gives every report its own Report ID automatically.
        </p>
        <div className="text-input">
          <input
            id={id("patientRef")}
            value={value.patientRef}
            maxLength={30}
            onChange={(event) => onChange("patientRef", event.target.value)}
            placeholder="e.g. MRN-104522"
            autoComplete="off"
          />
        </div>
        {error("patientRef")}
      </div>

      <div className="staff-field-pair">
        <div id={`field-${id("injuryDate")}`} className={`field${isMissing("injuryDate") ? " is-missing" : ""}`}>
          <label className="field-label" htmlFor={id("injuryDate")}>
            <span>
              Date of injury <span className="required-mark">*</span>
            </span>
          </label>
          <div className="text-input">
            <input
              id={id("injuryDate")}
              type="date"
              max={today()}
              value={value.injuryDate}
              onChange={(event) => onChange("injuryDate", event.target.value)}
            />
          </div>
          {error("injuryDate")}
        </div>

        <div id={`field-${id("timeSince")}`} className={`field${isMissing("timeSince") ? " is-missing" : ""}`}>
          <label className="field-label" htmlFor={id("timeSince")}>
            <span>
              Time since injury <span className="required-mark">*</span>
            </span>
          </label>
          <select
            id={id("timeSince")}
            className="staff-select"
            value={value.timeSince}
            onChange={(event) => onChange("timeSince", event.target.value)}
          >
            <option value="">Choose…</option>
            {TIME_SINCE.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          {error("timeSince")}
        </div>
      </div>

      <div id={`field-${id("pain")}`} className={`field${isMissing("pain") ? " is-missing" : ""}`} role="group" aria-labelledby={id("pain-label")}>
        <span className="field-label" id={id("pain-label")}>
          <span>
            Pain level <span className="required-mark">*</span>
          </span>
        </span>
        <p className="field-hint">0 = no pain, 10 = worst pain imaginable.</p>
        <div className="choices choices-segmented staff-pain" role="radiogroup">
          {PAIN_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={value.pain === level}
              className={value.pain === level ? "is-selected" : ""}
              onClick={() => onChange("pain", level)}
            >
              {level}
            </button>
          ))}
        </div>
        {error("pain")}
      </div>

      <div id={`field-${id("diabetes")}`} className={`field${isMissing("diabetes") ? " is-missing" : ""}`} role="group" aria-labelledby={id("diabetes-label")}>
        <span className="field-label" id={id("diabetes-label")}>
          <span>
            Diabetes status <span className="required-mark">*</span>
          </span>
        </span>
        <div className="choices choices-segmented" role="radiogroup" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {DIABETES.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={value.diabetes === option}
              className={value.diabetes === option ? "is-selected" : ""}
              onClick={() => onChange("diabetes", option)}
            >
              {option}
            </button>
          ))}
        </div>
        {error("diabetes")}
      </div>

      <div className="field">
        <label className="field-label" htmlFor={id("medicalHistory")}>
          Relevant medical history <span className="optional-mark">Optional</span>
        </label>
        <textarea
          id={id("medicalHistory")}
          className="staff-textarea"
          rows={3}
          maxLength={700}
          value={value.medicalHistory}
          onChange={(event) => onChange("medicalHistory", event.target.value)}
          placeholder="e.g. asthma, previous burns, current medicines"
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor={id("notes")}>
          Clinical notes <span className="optional-mark">Optional</span>
        </label>
        <textarea
          id={id("notes")}
          className="staff-textarea"
          rows={3}
          maxLength={1000}
          value={value.notes}
          onChange={(event) => onChange("notes", event.target.value)}
          placeholder="What you see: blisters, colour, first aid already given…"
        />
      </div>
    </div>
  );
}

export default ClinicalFields;