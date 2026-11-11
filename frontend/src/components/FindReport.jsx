/* =====================================================================
   BurnCare — components/FindReport.jsx
   ---------------------------------------------------------------------
   "Find a patient's report" box for healthcare staff. Type either:
     • a Report ID (BC-261029-7K4QX)  → that report opens straight away
     • a patient's name or hospital file number → their reports are
       listed underneath (GET /api/staff/find?q=..., backend/staff.py)
   Used on the staff Home page (variant="hero"), on Reports, and on the
   report page when a Report ID is not found.
   Styles: "14. HEALTHCARE STAFF PAGES" in styles.css.
   ===================================================================== */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../auth.js";
import { useNotificationState } from "./PopupNotifications.jsx";
import { REPORT_ID_PATTERN, cleanReportId, resultOf } from "../staffData.js";

function FindReport({ variant = "card", startWith = "" }) {
  const navigate = useNavigate();
  const [text, setText] = useState(startWith);
  const [problem, setProblem] = useNotificationState(""); // shown as a pop-up
  const [results, setResults] = useState(null); // null = no search yet
  const [searching, setSearching] = useState(false);
  const hero = variant === "hero";
  const inputId = hero ? "home-find" : "find-report";

  const find = async (event) => {
    event.preventDefault();
    const typed = text.trim();
    if (!typed) return setProblem("Type a Report ID or the patient's name.");

    // A Report ID → open it.
    const id = cleanReportId(typed);
    if (REPORT_ID_PATTERN.test(id)) return navigate(`/staff/reports/${id}`);
    if (/^BC-/i.test(typed)) {
      return setProblem("A Report ID looks like BC-261029-7K4QX. Please check it and try again.");
    }

    // Otherwise → search by the patient's name or file number.
    setSearching(true);
    setProblem("");
    try {
      const data = await api(`/api/staff/find?q=${encodeURIComponent(typed)}`);
      setResults(data.results);
    } catch (error) {
      setResults(null);
      setProblem(error.message);
    } finally {
      setSearching(false);
    }
  };

  const form = (
    <form className={`staff-find${hero ? " staff-find-hero" : ""}`} onSubmit={find} noValidate role="search">
      <label className="field-label" htmlFor={inputId}>
        {hero ? "Find a patient's report" : "Report ID or patient name"}
      </label>
      <p className="field-hint">Type the Report ID from the top of the report, or the patient&apos;s name.</p>
      <div className="staff-find-row">
        <div className="text-input">
          <input
            id={inputId}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setProblem("");
            }}
            placeholder="BC-261029-7K4QX or Sara Ahmed"
            autoComplete="off"
            spellCheck="false"
          />
        </div>
        <button type="submit" className={`button ${hero ? "button-dark" : "button-primary"}`} disabled={searching}>
          {searching ? "Searching…" : "Find"}
        </button>
      </div>
      {problem && <p className="field-error">{problem}</p>}
      {results && <Results results={results} />}
    </form>
  );

  if (hero) return form;
  return (
    <section className="patient-card" aria-labelledby="find-title">
      <div className="patient-card-head">
        <h2 id="find-title">Find a patient&apos;s report</h2>
      </div>
      {form}
    </section>
  );
}

// The reports found by name.
function Results({ results }) {
  if (results.length === 0) {
    return <p className="patient-empty staff-find-empty">No patient with this name or file number.</p>;
  }
  return (
    <ul className="staff-find-results" aria-label="Reports found">
      {results.map((r) => {
        const level = resultOf(r.decision);
        return (
          <li key={r.id}>
            <Link to={`/staff/reports/${r.id}`} className="staff-find-result">
              <span className={`report-dot tone-${level.tone}`} aria-hidden="true" />
              <span className="staff-find-result-main">
                <strong>{r.patientName || r.patientRef || "Patient"}</strong>
                <span className="staff-report-meta">
                  {r.id} · {r.createdAt.split(",")[0]} · {level.label}
                </span>
              </span>
              <span className="patient-card-link" aria-hidden="true">
                Open
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default FindReport;