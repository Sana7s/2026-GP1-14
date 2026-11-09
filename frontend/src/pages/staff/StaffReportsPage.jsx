/* =====================================================================
   BurnCare — pages/staff/StaffReportsPage.jsx
   ---------------------------------------------------------------------
   Reports (/staff/reports).
     1. Find a patient's report — by its Report ID (the patient shares
        it) or by the patient's name (components/FindReport.jsx).
     2. Your reports — the reports this staff member assessed, reviewed,
        or asked/answered a specialist about (GET /api/staff/reports),
        with a search box.
   Clicking a report opens /staff/reports/<Report ID>.
   Styles: sections "10. PATIENT PAGES" and "14. HEALTHCARE STAFF PAGES".
   ===================================================================== */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../auth.js";
import FindReport from "../../components/FindReport.jsx";
import { formatPercent } from "../../tbsa/tbsaCharts.js";
import { SOURCE_LABEL, resultOf } from "../../staffData.js";

function StaffReportsPage() {
  // null = loading, "error" = couldn't load, otherwise the list from Flask.
  const [reports, setReports] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let isCurrent = true;
    api("/api/staff/reports")
      .then((data) => isCurrent && setReports(data.reports))
      .catch(() => isCurrent && setReports("error"));
    return () => {
      isCurrent = false;
    };
  }, []);

  const query = search.trim().toLowerCase();
  const shown = (Array.isArray(reports) ? reports : []).filter(
    (r) => !query || [r.id, r.patientRef, r.cause, r.assessedBy].some((text) => String(text).toLowerCase().includes(query)),
  );

  return (
    <div className="patient-page">
      <header className="staff-page-head">
        <div>
          <h1>Reports</h1>
          <p>Find a patient&apos;s report by its Report ID or the patient&apos;s name, or go back to a report you worked on.</p>
        </div>
        <Link to="/staff/assessment" className="button button-primary">
          New assessment
        </Link>
      </header>

      {/* ===== 1. Find by Report ID or patient name ===== */}
      <FindReport />

      {/* ===== 2. Your reports ===== */}
      <section className="patient-card" aria-labelledby="list-title">
        <div className="patient-card-head">
          <h2 id="list-title">Your reports</h2>
          {Array.isArray(reports) && <span className="staff-count">{reports.length}</span>}
        </div>
        <p className="patient-card-text">
          Reports you assessed, reviewed, or asked a specialist about.
        </p>

        <div className="text-input staff-search">
          <label className="visually-hidden" htmlFor="report-search">
            Search reports
          </label>
          <input
            id="report-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by Report ID, hospital file number or cause"
          />
        </div>

        {reports === null && <p className="patient-empty">Loading reports…</p>}
        {reports === "error" && <p className="patient-empty">We couldn&apos;t load the reports. Please refresh the page.</p>}
        {Array.isArray(reports) && reports.length === 0 && (
          <p className="patient-empty">No reports yet. Start a new assessment, or open a patient&apos;s report above.</p>
        )}
        {Array.isArray(reports) && reports.length > 0 && shown.length === 0 && (
          <p className="patient-empty">No report matches “{search.trim()}”.</p>
        )}

        {shown.length > 0 && (
          <ul className="staff-report-list">
            {shown.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// One report in the list.
function ReportCard({ report }) {
  const level = resultOf(report.decision);
  return (
    <li>
      <Link to={`/staff/reports/${report.id}`} className="staff-report-card">
        <span className={`report-dot tone-${level.tone}`} aria-hidden="true" />
        <span className="staff-report-main">
          <span className="staff-report-title">
            {report.patientRef || (report.source === "patient" ? report.assessedBy : report.id)}
            {(report.patientRef || report.source === "patient") && <span className="staff-report-id">{report.id}</span>}
          </span>
          <span className="staff-report-meta">
            {report.createdAt} · {report.cause} · {report.age}
          </span>
          <span className="staff-report-meta">
            {SOURCE_LABEL[report.source]}
            {report.source === "staff" ? ` · ${report.assessedBy}` : ""}
          </span>
        </span>
        <span className="staff-report-side">
          <span className={`staff-result tone-text-${level.tone}`}>{level.label}</span>
          <span className="staff-report-meta">
            {report.tbsa != null ? `${formatPercent(report.tbsa)}% TBSA` : "No burn size"}
          </span>
          {report.reviewed && <span className="staff-approval is-approved">Reviewed</span>}
        </span>
      </Link>
    </li>
  );
}

export default StaffReportsPage;