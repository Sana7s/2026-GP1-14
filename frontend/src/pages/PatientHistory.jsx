/* =====================================================================
   BurnCare — pages/PatientHistory.jsx
   Patient assessment history matching BBA decision cards & styles.css
   ---------------------------------------------------------------------
   The list comes from the database: GET /api/assessments/mine
   (newest first, only the signed-in patient's own assessments).
   ===================================================================== */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../auth.js";
import { RESULT_LEVELS } from "../patientData.js";

// Badge colours for each result (background, text).
const BADGE = {
  urgent: ["var(--blush)", "var(--rose)"],
  soon: ["#fdf3e2", "#9a6412"],
  home: ["#e8f5e9", "#2e7d32"],
  pending: ["#f1eff0", "#5f5a5d"],
};

function PatientHistory() {
  // null = loading, "error" = couldn't load, otherwise the list from Flask.
  const [records, setRecords] = useState(null);
  const [search, setSearch] = useState("");

  // Load the patient's assessments from the database once.
  useEffect(() => {
    let isCurrent = true;
    api("/api/assessments/mine")
      .then((data) => {
        if (isCurrent) setRecords(data.assessments ?? []);
      })
      .catch(() => {
        if (isCurrent) setRecords("error");
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  const filtered = (Array.isArray(records) ? records : []).filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return String(r.id || "").toLowerCase().includes(q);
  });

  return (
    <section className="guest-page">
      <div className="guest-container">
        <header className="guest-header">
          <div>
            <p className="guest-step-label">Patient Portal</p>
            <h1>Assessment History</h1>
            <p className="guest-subtitle">Review saved reports, triage outcomes, and clinical recommendations.</p>
          </div>
          <Link className="button button-primary" to="/patient/assessment">
            ＋ New Assessment
          </Link>
        </header>

        <section className="guest-step" style={{ borderTop: "none", paddingTop: "0" }}>
          <div className="field-grid" style={{ marginBottom: "28px" }}>
            <div className="field">
              <label className="field-label" htmlFor="hist-search">Search by Report ID</label>
              <div className="text-input">
                <input
                  id="hist-search"
                  type="search"
                  placeholder="e.g. BC-261021-..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            {records === null || records === "error" || filtered.length === 0 ? (
              <p style={{ margin: "30px 0", color: "var(--muted)", textAlign: "center" }}>
                {records === null && "Loading your assessments…"}
                {records === "error" && "We couldn't load your assessments. Please refresh the page."}
                {Array.isArray(records) &&
                  (records.length === 0 ? "No assessments logged yet." : "No report matches this ID.")}
              </p>
            ) : (
              filtered.map((r) => {
                const level = RESULT_LEVELS[r.decision] ?? RESULT_LEVELS.pending;
                const [badgeBackground, badgeColor] = BADGE[level.tone];
                return (
                  <article
                    key={r.id}
                    style={{
                      padding: "24px",
                      borderRadius: "var(--card-radius)",
                      background: "var(--white)",
                      border: "1px solid var(--line)",
                      boxShadow: "var(--card-shadow)",
                      marginBottom: "20px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "8px" }}>
                      <h3 style={{ margin: 0, fontSize: "var(--text-card)", color: "var(--rose)" }}>{r.id}</h3>
                      <span
                        className="soon-badge"
                        style={{ background: badgeBackground, color: badgeColor }}
                      >
                        {level.label}
                      </span>
                    </div>

                    <p style={{ margin: "4px 0 16px", color: "var(--muted)", fontSize: "var(--text-small)" }}>
                      {r.createdAt}
                    </p>

                    <dl className="guest-summary" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                      <div><dt>Age</dt><dd>{r.age || "—"}</dd></div>
                      <div><dt>Cause</dt><dd>{r.cause || "—"}</dd></div>
                      <div><dt>Circumferential</dt><dd>{r.circumferential || "—"}</dd></div>
                    </dl>

                    {r.reasons?.length > 0 && (
                      <div style={{ marginTop: "16px", padding: "10px 14px", background: "var(--blush-soft)", borderRadius: "8px" }}>
                        <p style={{ margin: 0, fontSize: "var(--text-label)", color: "var(--ink-soft)" }}>
                          <strong>Reason:</strong> {r.reasons.join(" · ")}
                        </p>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

export default PatientHistory;