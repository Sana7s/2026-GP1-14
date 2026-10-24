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
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    const fetchHistoryFromBackend = async () => {
      try {
        setLoading(true);
        setFetchError(null);

        const response = await fetch("http://localhost:5000/api/assessments");
        const data = await response.json();

        if (response.ok) {
          // Normalize API response to handle list of assessments
          const assessmentList = Array.isArray(data) ? data : data.assessments || [];
          setRecords(assessmentList);
        } else {
          setFetchError(data.error || "Failed to retrieve assessments.");
        }
      } catch (err) {
        console.error("Network error fetching assessments:", err);
        setFetchError("Unable to connect to Flask server. Please ensure port 5000 is running.");
      } finally {
        setLoading(false);
      }
    };

    fetchHistoryFromBackend();
  }, []);

  const filtered = records.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const reportId = r.report_code || r.id || "";
    return String(reportId).toLowerCase().includes(q);
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
                  placeholder="e.g. BC-261022-..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            {loading && (
              <p style={{ margin: "30px 0", color: "var(--muted)", textAlign: "center" }}>
                Loading assessments from database...
              </p>
            )}

            {fetchError && (
              <p style={{ margin: "30px 0", color: "var(--rose)", textAlign: "center" }}>
                {fetchError}
              </p>
            )}

            {!loading && !fetchError && filtered.length === 0 && (
              <p style={{ margin: "30px 0", color: "var(--muted)", textAlign: "center" }}>
                No assessments logged yet.
              </p>
            )}

            {!loading && !fetchError && filtered.map((r) => {
              const reportId = r.report_code || r.id;
              const decisionValue = r.decision || r.result?.decision || "";
              const isBurnUnit = decisionValue === "burn_unit" || decisionValue === "burn-unit";
              const createdDate = r.created_at || r.createdAt;
              const imageName = r.photo_filename || r.image_name || r.imageName || "Uploaded Photo";
              const ageValue = r.age_group || r.form?.age || "—";
              const causeValue = r.cause || r.form?.cause || "—";
              const circValue = r.circumferential || r.form?.circumferential || "—";

              // Handle reasons array whether returned at top level or nested
              const reasonsList = r.reasons || r.result?.reasons || [];

              return (
                <article
                  key={reportId}
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
                    <h3 style={{ margin: 0, fontSize: "var(--text-card)", color: "var(--rose)" }}>
                      {reportId}
                    </h3>
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
                    {createdDate ? new Date(createdDate).toLocaleString() : "—"} · Image: {imageName}
                  </p>

                  <dl className="guest-summary" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                    <div><dt>Age</dt><dd>{ageValue}</dd></div>
                    <div><dt>Cause</dt><dd>{causeValue}</dd></div>
                    <div><dt>Circumferential</dt><dd>{circValue}</dd></div>
                  </dl>

                  {reasonsList.length > 0 && (
                    <div style={{ marginTop: "16px", padding: "10px 14px", background: "var(--blush-soft)", borderRadius: "8px" }}>
                      <p style={{ margin: 0, fontSize: "var(--text-label)", color: "var(--ink-soft)" }}>
                        <strong>Reason:</strong> {Array.isArray(reasonsList) ? reasonsList.join(" · ") : reasonsList}
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}

export default PatientHistory;