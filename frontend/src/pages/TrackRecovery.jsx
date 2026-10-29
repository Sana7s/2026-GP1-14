/* =====================================================================
   BurnCare — pages/TrackRecovery.jsx
   Recovery timeline with symptom check & BBA warning triggers.
   Uses api() from auth.js to load only the signed-in patient's assessments.
   ===================================================================== */

import { useState, useEffect, useRef } from "react";
import { api } from "../auth.js";

const PHOTO_TYPES = ["image/jpeg", "image/png"];
const MAX_PHOTO_MB = 10;

function TrackRecovery() {
  const [entries, setEntries] = useState([]);
  const [assessmentList, setAssessmentList] = useState([]);
  const [selectedReport, setSelectedReport] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [hasFever, setHasFever] = useState("No");
  const [increasingRedness, setIncreasingRedness] = useState("No");
  const [problem, setProblem] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let isCurrent = true;

    const fetchInitialData = async () => {
      try {
        // Fetch only the signed-in patient's own assessments
        const assessmentsData = await api("/api/assessments/mine");
        const list = Array.isArray(assessmentsData?.assessments)
          ? assessmentsData.assessments
          : (Array.isArray(assessmentsData) ? assessmentsData : []);

        if (isCurrent) {
          setAssessmentList(list);
          if (list.length > 0) {
            setSelectedReport(list[0].id || list[0].report_code || "");
          }
        }

        // Fetch recovery timeline entries with fallback handling
        const recoveryData = await api("/api/recovery/mine").catch(async () => {
          const res = await fetch("/api/recovery", { credentials: "same-origin" });
          return res.ok ? await res.json() : [];
        });

        if (isCurrent && Array.isArray(recoveryData)) {
          setEntries(recoveryData);
        }
      } catch (err) {
        console.error("Failed to load initial recovery data:", err);
      }
    };

    fetchInitialData();

    return () => {
      isCurrent = false;
    };
  }, []);

  const choosePhoto = (file) => {
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) {
      setProblem("Please choose a JPG or PNG image.");
      return;
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      setProblem(`Photo exceeds ${MAX_PHOTO_MB} MB.`);
      return;
    }
    setProblem("");
    setPhoto(file);
    setPhotoUrl(URL.createObjectURL(file));
  };

  const removePhoto = () => {
    setPhoto(null);
    setPhotoUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!photo) {
      setProblem("Please choose a follow-up photo.");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("date", date);
      formData.append("reportCode", selectedReport);
      formData.append("photo", photo);
      formData.append("notes", notes.trim());
      formData.append("hasFever", hasFever);
      formData.append("increasingRedness", increasingRedness);

      const response = await fetch("/api/recovery", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });

      if (response.ok) {
        const savedEntry = await response.json();
        setEntries((prev) => [savedEntry, ...prev]);
        removePhoto();
        setNotes("");
        setHasFever("No");
        setIncreasingRedness("No");
        setProblem("");
      } else {
        const errData = await response.json();
        setProblem(errData.error || "Failed to save recovery record.");
      }
    } catch (err) {
      console.error("Network error saving recovery entry:", err);
      setProblem("Could not connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="guest-page">
      <div className="guest-container">
        <header className="guest-header">
          <div>
            <p className="guest-step-label">Healing Progress</p>
            <h1>Track Recovery</h1>
            <p className="guest-subtitle">Log progress photos and monitor healing milestones.</p>
          </div>
          <span className="soon-badge">Timeline Active</span>
        </header>

        <form onSubmit={handleSubmit} noValidate>
          <section className="guest-step">
            <div className="guest-step-head">
              <span className="guest-step-label">Follow-up Entry</span>
              <h2 className="guest-step-title">Add healing progress observation</h2>
            </div>

            <div className="field-grid">
              <div className="field">
                <label className="field-label" htmlFor="rec-report">
                  Linked Assessment Report
                </label>
                <select
                  id="rec-report"
                  value={selectedReport}
                  onChange={(e) => setSelectedReport(e.target.value)}
                >
                  {assessmentList.length === 0 ? (
                    <option value="">No previous assessments found</option>
                  ) : (
                    assessmentList.map((item) => {
                      const code = item.id || item.report_code;
                      return (
                        <option key={code} value={code}>
                          {code} — {item.cause || "Assessment"}
                        </option>
                      );
                    })
                  )}
                </select>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="rec-date">
                  Observation Date <span className="required-mark">*</span>
                </label>
                <div className="text-input">
                  <input
                    id="rec-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <span className="field-label">Follow-up Photo <span className="required-mark">*</span></span>
                {photoUrl ? (
                  <div className="photo-preview">
                    <img src={photoUrl} alt="Progress Preview" />
                    <div className="photo-preview-bar">
                      <span className="photo-name">{photo?.name}</span>
                      <button type="button" className="text-link" onClick={removePhoto}>Remove</button>
                    </div>
                  </div>
                ) : (
                  <label htmlFor="rec-file" className="dropzone">
                    <span className="dropzone-title">Upload progress photo</span>
                    <span className="dropzone-hint">JPG or PNG, up to {MAX_PHOTO_MB} MB</span>
                  </label>
                )}
                <input
                  ref={fileInputRef}
                  id="rec-file"
                  className="visually-hidden"
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={(e) => choosePhoto(e.target.files?.[0])}
                />
                {problem && <p className="field-error">{problem}</p>}
              </div>

              <div className="field">
                <span className="field-label">New fever or signs of systemic illness?</span>
                <div className="choices choices-segmented" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  {["Yes", "No"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={hasFever === opt ? "is-selected" : ""}
                      onClick={() => setHasFever(opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <span className="field-label">Spreading redness or increased severe pain?</span>
                <div className="choices choices-segmented" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  {["Yes", "No"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={increasingRedness === opt ? "is-selected" : ""}
                      onClick={() => setIncreasingRedness(opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label className="field-label" htmlFor="rec-notes">Observation Notes (optional)</label>
                <div className="text-input">
                  <input
                    id="rec-notes"
                    placeholder="Wound dressing changes, peeling, healing progress..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="guest-submit" style={{ borderTop: "none", paddingTop: "24px" }}>
              <button type="submit" className="button button-primary button-wide" disabled={loading}>
                {loading ? "Saving..." : "Save Follow-up"}
              </button>
            </div>
          </section>
        </form>

        <section className="guest-step">
          <div className="guest-step-head">
            <span className="guest-step-label">Progress History</span>
            <h2 className="guest-step-title">Recovery Timeline</h2>
          </div>

          <div>
            {entries.length === 0 ? (
              <p style={{ margin: "24px 0", color: "var(--muted)", textAlign: "center" }}>
                No follow-up entries logged yet.
              </p>
            ) : (
              entries.map((item) => (
                <article
                  key={item.id}
                  style={{
                    padding: "20px",
                    borderRadius: "var(--card-radius)",
                    background: "var(--white)",
                    border: "1px solid var(--line)",
                    boxShadow: "var(--card-shadow)",
                    marginBottom: "16px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <h3 style={{ margin: 0, fontSize: "var(--text-card)" }}>{item.date}</h3>
                    {item.warningTriggered && (
                      <span className="soon-badge" style={{ background: "var(--blush)", color: "var(--rose)" }}>
                        Specialist Review Advised
                      </span>
                    )}
                  </div>
                  <p style={{ margin: "6px 0", color: "var(--muted)", fontSize: "var(--text-small)" }}>
                    Photo: {item.imageName || "Follow-up Image"}
                  </p>
                  <p style={{ margin: "8px 0 0", fontSize: "var(--text-body)" }}>
                    {item.notes || "No notes logged for this entry."}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

export default TrackRecovery;