/* =====================================================================
   BurnCare — pages/staff/StaffReportPage.jsx
   ---------------------------------------------------------------------
   One report for healthcare staff (/staff/reports/<Report ID>).
   Any approved staff member can open a report with its Report ID.
     • The report itself — the SAME report the patient sees
       (ReportPaper from pages/ReportPage.jsx), plus the clinical details
       and the clinicians' reviews.
     • Clinical details — add or correct them (PUT .../clinical).
     • Clinician review — final decision, depth, adjusted burn size and
       the reason (POST .../review). After a review the patient can no
       longer edit the report.
     • Ask a burn specialist — about this report (POST /api/consultations).
   Data: GET /api/staff/reports/<Report ID> (backend/staff.py).
   Styles: report styles (section 10) + "14. HEALTHCARE STAFF PAGES".
   ===================================================================== */

import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { api } from "../../auth.js";
import ClinicalFields from "../../components/ClinicalFields.jsx";
import { formatPercent } from "../../tbsa/tbsaCharts.js";
import { ReportPaper, ReportSection } from "../ReportPage.jsx";
import { FindReport } from "./StaffReportsPage.jsx";
import {
  CONSULT_STATUS,
  DEPTHS,
  EMPTY_CLINICAL,
  REVIEW_DECISIONS,
  clinicalProblem,
  depthLabel,
  niceDateTime,
  resultOf,
} from "../../staffData.js";

function StaffReportPage() {
  const { reportId } = useParams();
  const location = useLocation();
  const [data, setData] = useState(null); // { report, clinical, reviews, consultations, isSpecialist }
  const [loadProblem, setLoadProblem] = useState("");
  const [notice, setNotice] = useState(location.state?.notice ?? "");

  // (Re)load the report from the database.
  const load = useCallback(
    () =>
      api(`/api/staff/reports/${encodeURIComponent(reportId)}`)
        .then((found) => {
          setData(found);
          setLoadProblem("");
        })
        .catch((error) => setLoadProblem(error.message)),
    [reportId],
  );

  useEffect(() => {
    load();
  }, [load]);

  if (loadProblem && !data) {
    return (
      <div className="patient-page">
        <Toolbar />
        <p className="patient-card staff-not-found" role="alert">
          {loadProblem}
        </p>
        <FindReport startWith={reportId} />
      </div>
    );
  }
  if (!data) return <p className="patient-empty profile-loading">Loading the report…</p>;

  const { report, clinical, reviews, consultations, isSpecialist } = data;
  const latest = reviews[0];

  return (
    <section className="guest-page staff-report-page">
      <div className="guest-container report-container">
        <Toolbar />

        {notice && (
          <p className="report-updated" role="status">
            {notice}
          </p>
        )}

        {/* ----- Review status ----- */}
        {report.review ? (
          <p className="report-locked" role="note">
            <CheckIcon />
            <span>
              Reviewed by <strong>{report.review.by}</strong>
              {report.review.at ? ` on ${niceDateTime(report.review.at)}` : ""}.
              {latest ? ` Clinician's decision: ${resultOf(latest.decision).label}.` : ""} The patient can no longer edit
              this report.
            </span>
          </p>
        ) : (
          <p className="report-locked staff-not-reviewed" role="note">
            <ClockIcon />
            <span>
              <strong>Not reviewed yet.</strong> Check the answers, the body map and the photo, then add your review
              below. <a href="#review">Review this report</a>
            </span>
          </p>
        )}

        {/* ----- The report (same as the patient's) + staff sections ----- */}
        <ReportPaper report={report}>
          <ReportSection title="Clinical details">
            <ClinicalRows clinical={clinical} />
          </ReportSection>
          {reviews.length > 0 && (
            <ReportSection title="Clinician review">
              <ul className="staff-review-list">
                {reviews.map((review, index) => (
                  <ReviewItem key={`${review.at}-${index}`} review={review} />
                ))}
              </ul>
            </ReportSection>
          )}
        </ReportPaper>

        {/* ----- What staff can do ----- */}
        <div className="staff-report-actions">
          <ClinicalCard
            reportId={report.id}
            clinical={clinical}
            onSaved={(next) => {
              setData((old) => ({ ...old, clinical: next }));
              setNotice("Clinical details saved.");
              load(); // the change history may have a new line
            }}
          />
          <ReviewCard
            report={report}
            reviewed={reviews.length > 0}
            onSaved={() => {
              setNotice("Your review is saved. The patient can no longer edit this report.");
              load();
              window.scrollTo(0, 0);
            }}
          />
          <ConsultCard
            reportId={report.id}
            consultations={consultations}
            isSpecialist={isSpecialist}
            onAsked={() => {
              setNotice("Your question was sent to the burn specialists.");
              load();
            }}
          />
        </div>
      </div>
    </section>
  );
}

function Toolbar() {
  return (
    <div className="report-toolbar">
      <Link className="back-button" to="/staff/reports">
        <BackIcon />
        Reports
      </Link>
    </div>
  );
}

/* ---------- Clinical details (inside the report) ---------- */
function ClinicalRows({ clinical }) {
  if (clinical.pain === "") {
    return <p className="report-pending">No clinical details yet. Add them below.</p>;
  }
  const rows = [
    ["Hospital file number", clinical.patientRef],
    ["Date of injury", clinical.injuryDate ? new Date(`${clinical.injuryDate}T00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""],
    ["Time since injury", clinical.timeSince],
    ["Pain level", clinical.pain === "" ? "" : `${clinical.pain} / 10`],
    ["Diabetes status", clinical.diabetes],
    ["Relevant medical history", clinical.medicalHistory],
    ["Clinical notes", clinical.notes],
  ];
  return (
    <dl className="report-rows">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd className="staff-pre">{value === "" || value == null ? "—" : value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ReviewItem({ review }) {
  const result = resultOf(review.decision);
  return (
    <li className="staff-review">
      <p className="staff-review-head">
        <span className={`report-dot tone-${result.tone}`} aria-hidden="true" />
        <strong>{result.label}</strong>
        <span className="staff-review-when">
          {review.by} · {niceDateTime(review.at)}
        </span>
      </p>
      <dl className="report-rows">
        <div>
          <dt>Burn depth</dt>
          <dd>{review.depth ? depthLabel(review.depth) : "Not recorded"}</dd>
        </div>
        <div>
          <dt>Burn size (TBSA)</dt>
          <dd>
            {review.adjustedTbsa != null
              ? `${formatPercent(review.adjustedTbsa)}% (body map: ${review.oldTbsa != null ? `${formatPercent(review.oldTbsa)}%` : "—"})`
              : "Body map value kept"}
          </dd>
        </div>
        <div>
          <dt>Reason</dt>
          <dd className="staff-pre">{review.reason}</dd>
        </div>
        {review.notes && (
          <div>
            <dt>Notes</dt>
            <dd className="staff-pre">{review.notes}</dd>
          </div>
        )}
      </dl>
    </li>
  );
}

/* ---------- Clinical details: add or correct ---------- */
function ClinicalCard({ reportId, clinical, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(EMPTY_CLINICAL);
  const [problem, setProblem] = useState(null);
  const [saving, setSaving] = useState(false);
  const empty = clinical.pain === "";

  const start = () => {
    setDraft({ ...EMPTY_CLINICAL, ...clinical });
    setProblem(null);
    setEditing(true);
  };

  const save = async (event) => {
    event.preventDefault();
    const found = clinicalProblem(draft);
    if (found) {
      setProblem(found);
      document.getElementById(`field-report-clinical-${found.key}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSaving(true);
    try {
      const saved = await api(`/api/staff/reports/${encodeURIComponent(reportId)}/clinical`, { method: "PUT", body: draft });
      setEditing(false);
      onSaved(saved.clinical);
    } catch (error) {
      setProblem({ key: error.field ?? "", message: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="patient-card" aria-labelledby="clinical-title">
      <div className="patient-card-head">
        <h2 id="clinical-title">Clinical details</h2>
        {!editing && (
          <button type="button" className="button button-secondary staff-small-button" onClick={start}>
            {empty ? "Add clinical details" : "Edit clinical details"}
          </button>
        )}
      </div>
      {!editing ? (
        <p className="patient-card-text">
          Date of injury, pain, time since injury, diabetes status and your notes. Changes are kept
          in the report&apos;s change history.
        </p>
      ) : (
        <form onSubmit={save} noValidate>
          <ClinicalFields
            idPrefix="report-clinical"
            value={draft}
            problem={problem}
            onChange={(key, value) => {
              setDraft((old) => ({ ...old, [key]: value }));
              if (problem?.key === key) setProblem(null);
            }}
          />
          {problem && !problem.key && <p className="field-error">{problem.message}</p>}
          <div className="staff-form-actions">
            <button type="button" className="button button-secondary" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="submit" className="button button-primary" disabled={saving}>
              {saving ? "Saving…" : "Save clinical details"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

/* ---------- Clinician review ---------- */
const EMPTY_REVIEW = { decision: "", depth: "", adjustedTbsa: "", reason: "", notes: "" };

function ReviewCard({ report, reviewed, onSaved }) {
  const [review, setReview] = useState(EMPTY_REVIEW);
  const [open, setOpen] = useState(!reviewed);
  const [problem, setProblem] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (key, value) => {
    setReview((old) => ({ ...old, [key]: value }));
    if (problem?.key === key) setProblem(null);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!review.decision) return setProblem({ key: "decision", message: "Please choose your decision." });
    if (review.reason.trim().length < 3) return setProblem({ key: "reason", message: "Please write the reason for your decision." });
    setSaving(true);
    try {
      await api(`/api/staff/reports/${encodeURIComponent(report.id)}/review`, { method: "POST", body: review });
      setReview(EMPTY_REVIEW);
      setOpen(false);
      onSaved();
    } catch (error) {
      setProblem({ key: error.field ?? "", message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const error = (key) => problem?.key === key && <p className="field-error">{problem.message}</p>;

  return (
    <section className="patient-card" id="review" aria-labelledby="review-title">
      <div className="patient-card-head">
        <h2 id="review-title">{reviewed ? "Add another review" : "Review this report"}</h2>
        {!open && (
          <button type="button" className="button button-secondary staff-small-button" onClick={() => setOpen(true)}>
            Add a review
          </button>
        )}
      </div>
      <p className="patient-card-text">
        BurnCare&apos;s result: <strong>{resultOf(report.result.decision).label}</strong>
        {report.tbsa != null ? ` · Body map: ${formatPercent(report.tbsa)}% TBSA` : ""}. Your review is saved with
        your name and the time, and earlier reviews stay in the report.
      </p>

      {open && (
        <form onSubmit={save} noValidate>
          <div className="field-grid">
            <div id="field-review-decision" className={`field${problem?.key === "decision" ? " is-missing" : ""}`} role="group" aria-labelledby="review-decision-label">
              <span className="field-label" id="review-decision-label">
                <span>
                  Your decision <span className="required-mark">*</span>
                </span>
              </span>
              <div className="choices choices-segmented staff-decision" role="radiogroup">
                {REVIEW_DECISIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={review.decision === option.value}
                    className={review.decision === option.value ? "is-selected" : ""}
                    onClick={() => set("decision", option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {error("decision")}
            </div>

            <div className="staff-field-pair">
              <div className="field">
                <label className="field-label" htmlFor="review-depth">
                  Burn depth <span className="optional-mark">Optional</span>
                </label>
                <select id="review-depth" className="staff-select" value={review.depth} onChange={(event) => set("depth", event.target.value)}>
                  <option value="">Not assessed</option>
                  {DEPTHS.map((depth) => (
                    <option key={depth.value} value={depth.value}>
                      {depth.label}
                    </option>
                  ))}
                </select>
                {error("depth")}
              </div>
              <div className="field">
                <label className="field-label" htmlFor="review-tbsa">
                  Adjusted burn size (%) <span className="optional-mark">Optional</span>
                </label>
                <div className="text-input">
                  <input
                    id="review-tbsa"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    inputMode="decimal"
                    value={review.adjustedTbsa}
                    onChange={(event) => set("adjustedTbsa", event.target.value)}
                    placeholder={report.tbsa != null ? `Body map: ${formatPercent(report.tbsa)}` : "e.g. 4.5"}
                  />
                </div>
                {error("adjustedTbsa")}
              </div>
            </div>

            <div id="field-review-reason" className={`field${problem?.key === "reason" ? " is-missing" : ""}`}>
              <label className="field-label" htmlFor="review-reason">
                <span>
                  Reason <span className="required-mark">*</span>
                </span>
              </label>
              <textarea
                id="review-reason"
                className="staff-textarea"
                rows={2}
                maxLength={500}
                value={review.reason}
                onChange={(event) => set("reason", event.target.value)}
                placeholder="What you found, e.g. blistered partial-thickness burn on the hand"
              />
              {error("reason")}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="review-notes">
                Notes for the team <span className="optional-mark">Optional</span>
              </label>
              <textarea
                id="review-notes"
                className="staff-textarea"
                rows={2}
                maxLength={1000}
                value={review.notes}
                onChange={(event) => set("notes", event.target.value)}
              />
            </div>
          </div>

          {problem && !["decision", "reason", "depth", "adjustedTbsa"].includes(problem.key) && (
            <p className="field-error">{problem.message}</p>
          )}
          <div className="staff-form-actions">
            {reviewed && (
              <button type="button" className="button button-secondary" onClick={() => setOpen(false)}>
                Cancel
              </button>
            )}
            <button type="submit" className="button button-primary" disabled={saving}>
              {saving ? "Saving…" : "Save review"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

/* ---------- Ask a burn specialist ---------- */
function ConsultCard({ reportId, consultations, isSpecialist, onAsked }) {
  const [question, setQuestion] = useState("");
  const [problem, setProblem] = useState("");
  const [sending, setSending] = useState(false);

  const ask = async (event) => {
    event.preventDefault();
    if (!question.trim()) return setProblem("Please write your question.");
    setSending(true);
    try {
      await api("/api/consultations", { method: "POST", body: { reportCode: reportId, question: question.trim() } });
      setQuestion("");
      setProblem("");
      onAsked();
    } catch (error) {
      setProblem(error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="patient-card" aria-labelledby="consult-title">
      <div className="patient-card-head">
        <h2 id="consult-title">{isSpecialist ? "Specialist consultations" : "Ask a burn specialist"}</h2>
        <Link to="/staff/consultations" className="patient-card-link">
          All consultations
        </Link>
      </div>

      {consultations.length > 0 && (
        <ul className="staff-consult-mini">
          {consultations.map((c) => {
            const status = CONSULT_STATUS[c.status] ?? CONSULT_STATUS.open;
            return (
              <li key={c.id}>
                <span className={`staff-approval ${status.tone}`}>{status.label}</span>
                <p className="staff-pre">{c.question}</p>
                <span className="staff-report-meta">
                  Asked by {c.askedBy} · {c.createdAt}
                  {c.specialist ? ` · Answered by ${c.specialist}` : ""}
                </span>
                <Link to={`/staff/consultations?open=${c.id}`} className="patient-card-link">
                  {isSpecialist && c.status === "open" ? "Answer" : "Open conversation"}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {isSpecialist ? (
        consultations.length === 0 && <p className="patient-empty">No questions about this report yet.</p>
      ) : (
        <form onSubmit={ask} noValidate className="staff-ask">
          <label className="field-label" htmlFor="ask-question">
            Your question
          </label>
          <textarea
            id="ask-question"
            className="staff-textarea"
            rows={3}
            maxLength={1200}
            value={question}
            onChange={(event) => {
              setQuestion(event.target.value);
              setProblem("");
            }}
            placeholder="What advice do you need about this burn?"
          />
          {problem && <p className="field-error">{problem}</p>}
          <div className="staff-form-actions">
            <button type="submit" className="button button-primary" disabled={sending}>
              {sending ? "Sending…" : "Send to a specialist"}
            </button>
          </div>
          <p className="patient-note">The first approved burn specialist to answer takes the case.</p>
        </form>
      )}
    </section>
  );
}

/* ---------- Small icons ---------- */
const line = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };

function BackIcon() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
      <path d="M8 2L4 6l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle {...line} cx="12" cy="12" r="8.5" />
      <path {...line} d="M8.5 12.2l2.4 2.4 4.6-4.9" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle {...line} cx="12" cy="12" r="8.5" />
      <path {...line} d="M12 7.5V12l3 2" />
    </svg>
  );
}

export default StaffReportPage;