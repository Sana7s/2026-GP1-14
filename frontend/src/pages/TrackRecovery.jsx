/* =====================================================================
   BurnCare — pages/TrackRecovery.jsx
   Recovery timeline with symptom check & BBA warning triggers.
   ===================================================================== */

import { useState, useEffect, useRef } from "react";

const PHOTO_TYPES = ["image/jpeg", "image/png"];
const MAX_PHOTO_MB = 10;

function TrackRecovery() {
  const [entries, setEntries] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [hasFever, setHasFever] = useState("No");
  const [increasingRedness, setIncreasingRedness] = useState("No");
  const [problem, setProblem] = useState("");
  const fileInputRef = useRef(null);

  const fetchTimeline = () => {
    const local = JSON.parse(localStorage.getItem("bc_recovery_store") || "[]");
    setEntries(local.sort((a, b) => b.date.localeCompare(a.date)));
  };

  useEffect(() => {
    fetchTimeline();
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!photo) {
      setProblem("Please choose a follow-up photo.");
      return;
    }

    const recId =
      "REC-" +
      (crypto.randomUUID
        ? crypto.randomUUID().slice(0, 8).toUpperCase()
        : Math.random().toString(36).substring(2, 10).toUpperCase());

    const warningTriggered = hasFever === "Yes" || increasingRedness === "Yes";

    const payload = {
      id: recId,
      date,
      imageName: photo.name,
      notes: notes.trim(),
      hasFever,
      increasingRedness,
      warningTriggered,
    };

    const store = JSON.parse(localStorage.getItem("bc_recovery_store") || "[]");
    const updated = [payload, ...store];
    localStorage.setItem("bc_recovery_store", JSON.stringify(updated));

    setEntries(updated.sort((a, b) => b.date.localeCompare(a.date)));
    removePhoto();
    setNotes("");
    setHasFever("No");
    setIncreasingRedness("No");
    setProblem("");
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

              <div className="field">
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

              <div className="field">
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
              <button type="submit" className="button button-primary button-wide">
                Save Follow-up
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
                    Photo: {item.imageName}
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
