/* =====================================================================
   BurnCare — pages/staff/StaffHomePage.jsx
   ---------------------------------------------------------------------
   The healthcare staff home page (/staff). Same layout as the patient
   home page:
     1. Welcome + quick actions (New assessment, Open a report by its ID)
     2. Recent reports           |  3. Consultations
   Where the information comes from: GET /api/staff/summary (staff.py).
   Staff waiting for the admin's approval see their status instead.
   Styles: sections "10. PATIENT PAGES" and "14. HEALTHCARE STAFF PAGES".
   ===================================================================== */

import { useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { Chevron } from "../../components/Chevron.jsx";
import { api } from "../../auth.js";
import {
  APPROVAL,
  REPORT_ID_PATTERN,
  SOURCE_LABEL,
  cleanReportId,
  isApproved,
  isSpecialist,
  resultOf,
  shortName,
} from "../../staffData.js";

// "23 Oct 2026, 14:40" (from Flask) → "23 Oct 2026"
const dayOnly = (text) => String(text || "").split(",")[0];

function StaffHomePage() {
  const { account } = useOutletContext(); // the signed-in staff member (StaffTopBar)
  const approved = isApproved(account);

  return (
    <div className="patient-home">
      <div className="patient-page">
        {approved ? <Welcome account={account} /> : <WaitingWelcome account={account} />}
        {approved && <Dashboard account={account} />}
      </div>
    </div>
  );
}

/* ---------- 1. Welcome + quick actions ---------- */
function Welcome({ account }) {
  const navigate = useNavigate();
  const [reportId, setReportId] = useState("");
  const [problem, setProblem] = useState("");

  const openReport = (event) => {
    event.preventDefault();
    const id = cleanReportId(reportId);
    if (!REPORT_ID_PATTERN.test(id)) {
      setProblem("A Report ID looks like BC-261029-7K4QX. Please check it and try again.");
      return;
    }
    navigate(`/staff/reports/${id}`);
  };

  return (
    <section className="patient-card patient-hero staff-hero" aria-labelledby="hero-title">
      <div className="patient-hero-copy">
        <p className="patient-welcome">Welcome back, {shortName(account.fullName)}</p>
        <h1 id="hero-title">Assess a burn</h1>
        <p className="patient-hero-text">
          Record the clinical details, mark the burn on the body map and add a photo. BurnCare works out the burn
          size and the BBA referral result, and keeps the report for review.
        </p>
        <div className="patient-hero-actions">
          <Link to="/staff/assessment" className="button button-primary">
            New assessment <Chevron />
          </Link>
          <Link to="/staff/reports" className="button button-secondary">
            Reports
          </Link>
        </div>
      </div>

      {/* Open a report a patient shared with you, by its Report ID. */}
      <form className="staff-find staff-find-hero" onSubmit={openReport} noValidate>
        <label className="field-label" htmlFor="home-report-id">
          Open a patient&apos;s report
        </label>
        <p className="field-hint">Patients find the Report ID at the top of their report.</p>
        <div className="staff-find-row">
          <div className="text-input">
            <input
              id="home-report-id"
              value={reportId}
              onChange={(event) => {
                setReportId(event.target.value);
                setProblem("");
              }}
              placeholder="BC-261029-7K4QX"
              autoComplete="off"
              spellCheck="false"
            />
          </div>
          <button type="submit" className="button button-dark">
            Open
          </button>
        </div>
        {problem && <p className="field-error">{problem}</p>}
      </form>
    </section>
  );
}

// Before the admin approves the account.
function WaitingWelcome({ account }) {
  const status = APPROVAL[account.staffStatus] ?? APPROVAL.pending;
  return (
    <>
      <section className="patient-card patient-hero staff-hero" aria-labelledby="hero-title">
        <div className="patient-hero-copy">
          <p className="patient-welcome">Welcome, {shortName(account.fullName)}</p>
          <h1 id="hero-title">Your account is almost ready</h1>
          <p className="patient-hero-text">
            The BurnCare team checks your SCFHS registration before you can assess burns or open patient reports.
            You don&apos;t need to do anything else for now.
          </p>
          <div className="patient-hero-actions">
            <span className={`staff-approval ${status.tone}`}>{status.label}</span>
            <Link to="/staff/profile" className="patient-card-link">
              See my profile
            </Link>
          </div>
        </div>
      </section>
      {account.staffStatus === "changes_requested" && (
        <section className="patient-card staff-waiting" role="status">
          <h2>The admin asked for changes</h2>
          <p>{account.adminNote || "Please check your registration details with the BurnCare admin."}</p>
        </section>
      )}
    </>
  );
}

/* ---------- 2 + 3. Recent reports and consultations ---------- */
function Dashboard({ account }) {
  // null = loading, "error" = couldn't load, otherwise the summary from Flask.
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let isCurrent = true;
    api("/api/staff/summary")
      .then((data) => isCurrent && setSummary(data))
      .catch(() => isCurrent && setSummary("error"));
    return () => {
      isCurrent = false;
    };
  }, []);

  const loading = summary === null;
  const failed = summary === "error";
  const reports = summary?.recent ?? [];

  return (
    <div className="patient-grid">
      {/* ===== 2. Recent reports ===== */}
      <section className="patient-card" aria-labelledby="recent-title">
        <div className="patient-card-head">
          <h2 id="recent-title">Recent reports</h2>
          <Link to="/staff/reports" className="patient-card-link">
            See all
          </Link>
        </div>

        {loading && <p className="patient-empty">Loading reports…</p>}
        {failed && <p className="patient-empty">We couldn&apos;t load your reports. Please refresh the page.</p>}
        {!loading && !failed && reports.length === 0 && (
          <p className="patient-empty">
            No reports yet. Reports you assess, review or ask a specialist about will appear here.
          </p>
        )}
        {reports.length > 0 && (
          <ul className="report-list">
            {reports.map((report) => {
              const level = resultOf(report.decision);
              return (
                <li key={report.id} className="report-row">
                  <span className={`report-dot tone-${level.tone}`} aria-hidden="true" />
                  <div className="report-info">
                    <p className="report-level">
                      {report.patientRef || (report.source === "patient" ? report.assessedBy : report.id)}
                      {" · "}
                      {level.label}
                    </p>
                    <p className="report-meta">
                      {dayOnly(report.createdAt)} · {SOURCE_LABEL[report.source]}
                      {report.reviewed ? " · Reviewed" : ""}
                    </p>
                  </div>
                  <Link
                    to={`/staff/reports/${report.id}`}
                    className="patient-card-link"
                    aria-label={`View report ${report.id}`}
                  >
                    View
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ===== 3. Consultations ===== */}
      <section className="patient-card" aria-labelledby="consult-title">
        <div className="patient-card-head">
          <h2 id="consult-title">Consultations</h2>
          <Link to="/staff/consultations" className="patient-card-link">
            Open
          </Link>
        </div>

        {loading && <p className="patient-empty">Loading…</p>}
        {failed && <p className="patient-empty">We couldn&apos;t load your consultations.</p>}
        {!loading && !failed && (
          <div className="staff-stats">
            {isSpecialist(account) && (
              <Stat
                number={summary.waitingConsultations}
                label="Waiting for a specialist"
                note="Questions from staff that no specialist has answered yet"
                highlight={summary.waitingConsultations > 0}
              />
            )}
            <Stat number={summary.myOpenQuestions} label="Your questions waiting" note="Sent to a burn specialist" />
            <Stat number={summary.myAnsweredQuestions} label="Answered" note="A specialist replied" />
          </div>
        )}

        <p className="patient-note">
          {isSpecialist(account)
            ? "As an approved burn specialist, you answer questions from other staff."
            : "Ask a burn specialist about any report from the report page."}
        </p>
      </section>
    </div>
  );
}

function Stat({ number, label, note, highlight }) {
  return (
    <div className={`staff-stat${highlight ? " is-highlight" : ""}`}>
      <strong>{number ?? 0}</strong>
      <div>
        <p>{label}</p>
        <span>{note}</span>
      </div>
    </div>
  );
}

export default StaffHomePage;