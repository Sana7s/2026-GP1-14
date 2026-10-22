/* =====================================================================
   BurnCare — pages/PatientHistory.jsx
   Patient assessment history matching BBA decision cards & styles.css
   ===================================================================== */

import { useState } from "react";
import { Link } from "react-router-dom";

function PatientHistory() {
  // Load the saved assessments once, when the page opens.
  const [records] = useState(() => JSON.parse(localStorage.getItem("bc_assessments_store") || "[]"));
  const [search, setSearch] = useState("");

  const filtered = records.filter((r) => {
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
            {filtered.length === 0 ? (
              <p style={{ margin: "30px 0", color: "var(--muted)", textAlign: "center" }}>
                No assessments logged yet.
              </p>
            ) : (
              filtered.map((r) => {
                const isBurnUnit = r.result?.decision === "burn-unit";
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
                        style={{
                          background: isBurnUnit ? "var(--blush)" : "#e8f5e9",
                          color: isBurnUnit ? "var(--rose)" : "#2e7d32",
                        }}
                      >
                        {isBurnUnit ? "Treat at a Burn Unit" : "Treat Locally"}
                      </span>
                    </div>

                    <p style={{ margin: "4px 0 16px", color: "var(--muted)", fontSize: "var(--text-small)" }}>
                      {new Date(r.createdAt).toLocaleString()} · Image: {r.imageName}
                    </p>

                    <dl className="guest-summary" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                      <div><dt>Age</dt><dd>{r.form?.age || "—"}</dd></div>
                      <div><dt>Cause</dt><dd>{r.form?.cause || "—"}</dd></div>
                      <div><dt>Circumferential</dt><dd>{r.form?.circumferential || "—"}</dd></div>
                    </dl>

                    {r.result?.reasons?.length > 0 && (
                      <div style={{ marginTop: "16px", padding: "10px 14px", background: "var(--blush-soft)", borderRadius: "8px" }}>
                        <p style={{ margin: 0, fontSize: "var(--text-label)", color: "var(--ink-soft)" }}>
                          <strong>Reason:</strong> {r.result.reasons.join(" · ")}
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