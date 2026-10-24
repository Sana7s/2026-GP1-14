/* =====================================================================
   BurnCare — pages/TbsaPage.jsx
   ---------------------------------------------------------------------
   Runs the TBSA flowchart from start to end (/tbsa):
     1. Attach photo
     2. AI depth classification  (TEST MODE until the model is ready)
     3. Enter age
     4. Mark burns on body map → Calculate TBSA → Output TBSA
   The calculator itself is <TbsaCalculator>, so the Guest and Patient
   assessments can reuse it with their own photo and age steps.
   ===================================================================== */

import { useCallback, useEffect, useState } from "react";
import TbsaCalculator from "../components/TbsaCalculator.jsx";

/* ---------------------------------------------------------------------
   TEST MODE — the AI model isn't trained yet. Until it is, the depth is
   chosen by hand after attaching a photo. Only on the dev server.
   --------------------------------------------------------------------- */
const USE_TEST_MODE = true; // ← change to false once the AI is connected
const TEST_MODE = USE_TEST_MODE && import.meta.env.DEV;

const DEPTHS = [
  { value: 1, label: "1st degree", hint: "Superficial — not counted" },
  { value: 2, label: "2nd degree", hint: "Partial thickness" },
  { value: 3, label: "3rd degree", hint: "Full thickness" },
];

function TbsaPage() {
  const [photo, setPhoto] = useState(null); // { file, url }
  const [depth, setDepth] = useState(null); // 1, 2 or 3
  const [ageText, setAgeText] = useState("");
  const [result, setResult] = useState(null);

  // Free the photo preview's memory when it's replaced.
  useEffect(() => () => photo && URL.revokeObjectURL(photo.url), [photo]);

  const ageNumber = ageText.trim() === "" ? null : Number(ageText);
  const ageProblem =
    ageNumber === null
      ? ""
      : !Number.isFinite(ageNumber) || ageNumber < 0 || ageNumber > 120
        ? "Enter an age between 0 and 120. Use 0 for babies under 1 year."
        : "";
  const age = ageNumber !== null && !ageProblem ? ageNumber : null;

  const handleResult = useCallback((next) => setResult(next), []);

  const choosePhoto = (file) => {
    if (!file) return;
    if (!/^image\/(jpeg|png)$/.test(file.type)) return; // US-06: JPEG/PNG
    setPhoto({ file, url: URL.createObjectURL(file) });
    setDepth(null); // a new photo needs a new depth
  };

  return (
    <section className="guest-page tbsa-page">
      <div className="tbsa-container">
        <header className="guest-header tbsa-header">
          <div>
            <h1>TBSA calculator</h1>
            <p className="guest-subtitle">Estimate how much of the body is burned.</p>
          </div>
        </header>

        {/* ===== 1. Attach photo ===== */}
        <div className="guest-step">
          <div className="guest-step-head">
            <span className="guest-step-label">Step 1</span>
            <h2 className="guest-step-title">Attach a photo of the burn</h2>
          </div>

          <div className="tbsa-photo-row">
            <label className={`tbsa-photo${photo ? " has-photo" : ""}`}>
              <input
                type="file"
                accept="image/jpeg,image/png"
                className="visually-hidden"
                onChange={(e) => choosePhoto(e.target.files?.[0])}
              />
              {photo ? (
                <img src={photo.url} alt="Attached burn" />
              ) : (
                <span className="tbsa-photo-empty">
                  <CameraIcon />
                  Choose a photo
                  <small>JPEG or PNG</small>
                </span>
              )}
            </label>

            {/* ===== 2. AI depth classification ===== */}
            <div className="tbsa-depth">
              <p className="field-label">Burn depth (from the AI)</p>
              {!photo && <p className="tbsa-depth-wait">Attach a photo to classify the burn depth.</p>}

              {photo && TEST_MODE && (
                <>
                  <p className="forgot-test-note">
                    <span className="forgot-test-badge">Test mode</span>
                    <span>The AI model isn&apos;t connected yet. Pick the depth it would return.</span>
                  </p>
                  <div className="tbsa-depth-options">
                    {DEPTHS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`tbsa-depth-option${depth === option.value ? " is-selected" : ""}`}
                        aria-pressed={depth === option.value}
                        onClick={() => setDepth(option.value)}
                      >
                        <strong>{option.label}</strong>
                        <span>{option.hint}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* TODO (AI): send the photo to the model and setDepth() with its
                  result; if it isn't confident, ask the user to retake the photo. */}
              {photo && !TEST_MODE && <p className="tbsa-depth-wait">Analysing the photo…</p>}
            </div>
          </div>
        </div>

        {/* ===== 3. Enter age ===== */}
        <div className="guest-step">
          <div className="guest-step-head">
            <span className="guest-step-label">Step 2</span>
            <h2 className="guest-step-title">Patient&apos;s age</h2>
          </div>
          <div className={`field tbsa-age${ageProblem ? " is-missing" : ""}`}>
            <label className="field-label" htmlFor="tbsa-age">
              Age in years
            </label>
            <div className="text-input has-action">
              <input
                id="tbsa-age"
                type="number"
                inputMode="decimal"
                min="0"
                max="120"
                step="any"
                placeholder="e.g. 34"
                value={ageText}
                onChange={(e) => setAgeText(e.target.value)}
                aria-invalid={Boolean(ageProblem)}
              />
              <span className="input-unit">years</span>
            </div>
            {ageProblem ? (
              <p className="field-error">{ageProblem}</p>
            ) : (
              <p className="field-hint">Use 0 for a baby under 1 year. The Lund and Browder chart changes with age.</p>
            )}
          </div>
        </div>

        {/* ===== 4. Mark burns → calculate → output ===== */}
        <div className="guest-step">
          <div className="guest-step-head">
            <span className="guest-step-label">Step 3</span>
            <h2 className="guest-step-title">Mark the burns on the body map</h2>
          </div>
          <TbsaCalculator age={age} depth={depth} onChange={handleResult} />
        </div>

        <p className="tbsa-disclaimer">
          An estimate to support assessment. It does not replace examination by a healthcare professional.
          {result && result.total > 0 && ` Current estimate: ${result.total}% TBSA.`}
        </p>
      </div>
    </section>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.4-2h4.6l1.4 2h1.8A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12.5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export default TbsaPage;