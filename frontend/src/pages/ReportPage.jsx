/* =====================================================================
   BurnCare — pages/ReportPage.jsx
   ---------------------------------------------------------------------
   One full report (/patient/reports/<report ID>), opened from "View" on
   the homepage and from My reports.
     • View: the result and its reasons, the emergency check, the
       answers, the burn size with each marked area, the photo, and the
       change history.
     • Edit (patients, their own reports, until a healthcare professional
       has reviewed the report — then it is locked): the same questions and the
       TBSA body map, filled with the saved answers. On "Save changes"
       Flask works out the burn size and the BBA result again
       (PATCH /api/assessments/<id>) and keeps the old values in the
       change history (table assessment_edits).
   Styles: the report and form styles of the assessment pages, plus
   "Report page" in section 10 of styles.css.
   ===================================================================== */

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../auth.js";
import BodyMap from "../components/BodyMap.jsx";
import TbsaCalculator from "../components/TbsaCalculator.jsx";
import { CHARTS, REGION_BY_ID, chooseChart, formatPercent, isChildChart } from "../tbsa/tbsaCharts.js";
import {
  AGE_GROUPS,
  AGE_IN_YEARS,
  BURN_CAUSES,
  CONDITIONS,
  DECISIONS,
  EMERGENCY_QUESTIONS,
  RISKY_ANSWERS,
  isChild,
} from "../assessmentOptions.js";

// "2026-10-24T09:12:00Z" → "24 Oct 2026, 12:12"
const niceDateTime = (iso) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

// "rightArmFront" → "Right arm (front)" (adult area) or "Right forearm" (child shape).
const areaLabel = (id) => CHARTS.adult.areaById[id]?.label ?? REGION_BY_ID[id]?.label ?? id;

// Change-history values in plain words: area names and result titles
// instead of the names saved in the database.
function readable(field, value) {
  if (value == null) return "—";
  if (field === "Result") return DECISIONS[value]?.title ?? value;
  if (field === "Burned areas") {
    return value.replace(/([A-Za-z]+) ([\d.]+)%/g, (_, id, percent) => `${areaLabel(id)} ${formatPercent(Number(percent))}%`);
  }
  if (field === "Burn size (TBSA %)") return `${formatPercent(Number(value))}%`;
  return value;
}

// The chart (and its areas) for an age group.
const chartFor = (ageGroup) => chooseChart(AGE_IN_YEARS[ageGroup] ?? 16);

// Saved areas → the body map's marks, exactly as they were entered:
// whole area, or a number of palms plus the shapes tapped (e.g. the hand
// inside the arm). Reports saved before the palms were kept only have
// the %: a full % means the whole area, anything less was palms.
function marksFromAreas(areas, ageGroup) {
  const chart = chartFor(ageGroup);
  const marks = {};
  for (const { id, percent, palms, touched = [] } of areas) {
    const area = chart.areaById[id];
    if (!area) continue;
    const wasPalms = palms != null || Math.abs(percent - area.value) >= 0.001;
    marks[id] = wasPalms
      ? { method: "palms", palms: palms ?? Math.max(1, Math.round(percent)), touched: [...touched] }
      : { method: "whole", palms: 0, touched: [] };
  }
  return marks;
}

function ReportPage() {
  const { reportId } = useParams();
  const [report, setReport] = useState(null);
  const [loadProblem, setLoadProblem] = useState("");
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState(""); // "Report updated" after saving

  // Load the report from the database.
  useEffect(() => {
    let isCurrent = true;
    api(`/api/assessments/${encodeURIComponent(reportId)}`)
      .then((data) => isCurrent && setReport(data.report))
      .catch((error) => isCurrent && setLoadProblem(error.message));
    return () => {
      isCurrent = false;
    };
  }, [reportId]);

  if (loadProblem) {
    return (
      <section className="guest-page">
        <div className="guest-container report-message">
          <p className="field-error">{loadProblem}</p>
          <Link className="button button-outline" to="/patient/reports">
            Back to My reports
          </Link>
        </div>
      </section>
    );
  }
  if (!report) return <p className="patient-empty profile-loading">Loading the report…</p>;

  if (editing) {
    return (
      <ReportEditor
        report={report}
        onCancel={() => setEditing(false)}
        onSaved={(updated) => {
          setReport(updated);
          setEditing(false);
          setNotice("Report updated. The burn size and the result were worked out again.");
          window.scrollTo(0, 0);
        }}
      />
    );
  }

  return (
    <section className="guest-page">
      <div className="guest-container report-container">
        <div className="report-toolbar">
          <Link className="back-button" to="/patient/reports">
            <BackIcon />
            My reports
          </Link>
          {report.canEdit && (
            <button
              type="button"
              className="button button-primary"
              onClick={() => {
                setNotice("");
                setEditing(true);
                window.scrollTo(0, 0);
              }}
            >
              Edit report
            </button>
          )}
        </div>
        {notice && (
          <p className="report-updated" role="status">
            {notice}
          </p>
        )}
        {report.review && (
          <p className="report-locked" role="note">
            <LockIcon />
            <span>
              Reviewed by <strong>{report.review.by}</strong>
              {report.review.at ? ` on ${niceDateTime(report.review.at)}` : ""}. A healthcare professional has checked
              this report, so it can no longer be edited.
            </span>
          </p>
        )}
        <ReportPaper report={report} />
      </div>
    </section>
  );
}

/* =====================================================================
   VIEW: the whole report, like a sheet of paper
   ===================================================================== */
// Exported so the healthcare staff report page shows the SAME report.
// "children" = extra sections (the staff page adds the clinical details
// and the clinician's review), shown before the change history.
export function ReportPaper({ report, children }) {
  const decision = DECISIONS[report.result.decision] ?? DECISIONS.pending;
  const chart = chartFor(report.form.age);
  const marks = marksFromAreas(report.areas, report.form.age);
  const child = isChild(report.form.age);
  const emergencyFlag = Object.values(report.emergency).some((value) => RISKY_ANSWERS.includes(value));

  const rows = [
    ["Patient's age", `${report.form.age} (${child ? "child" : "adult"})`],
    ["Cause of the burn", report.form.cause],
    ["Goes all the way around a body part", report.form.circumferential],
    ["Long-term conditions", report.form.conditions.join(", ")],
    ["Not healed after 2 weeks", report.form.notHealed],
    ...(child ? [["Child unwell or feverish", report.form.childUnwell]] : []),
  ];

  return (
    <article className="report-paper" aria-label="Burn assessment report">
      <header className="report-head">
        <div className="report-brand">
          <img src="/burncare-logo.png" alt="" className="report-logo" />
          <div>
            <p className="report-brand-name">BurnCare</p>
            <h1 className="report-title">Burn Assessment Report</h1>
          </div>
        </div>
        <dl className="report-meta">
          <div>
            <dt>Report ID</dt>
            <dd className="report-id">{report.id}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{niceDateTime(report.createdAt)}</dd>
          </div>
          {report.edits.length > 0 && (
            <div>
              <dt>Last edited</dt>
              <dd>{niceDateTime(report.edits[0].editedAt)}</dd>
            </div>
          )}
          <div>
            <dt>Assessed by</dt>
            <dd>{report.assessedBy}</dd>
          </div>
        </dl>
      </header>

      {/* ----- The result ----- */}
      <section className={`report-decision is-${report.result.decision}`}>
        <p className="report-decision-label">Recommendation</p>
        <h2>{decision.title}</h2>
        <p>{decision.text}</p>
        {report.result.reasons.length > 0 && (
          <ul className="report-reasons">
            {report.result.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
      </section>

      {emergencyFlag && (
        <p className="report-call">
          <strong>Call 997 now.</strong> An answer in the emergency check suggests a possible emergency.
        </p>
      )}

      {/* ----- Emergency check ----- */}
      <ReportSection title="Emergency check">
        <dl className="report-rows">
          {EMERGENCY_QUESTIONS.map((q) => (
            <div key={q.key}>
              <dt>{q.label}</dt>
              <dd className={RISKY_ANSWERS.includes(report.emergency[q.key]) ? "is-flag" : ""}>{report.emergency[q.key]}</dd>
            </div>
          ))}
        </dl>
      </ReportSection>

      {/* ----- Answers ----- */}
      <ReportSection title="About the burn">
        <dl className="report-rows">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value || "—"}</dd>
            </div>
          ))}
        </dl>
      </ReportSection>

      {/* ----- Burn size ----- */}
      <ReportSection title="Burn size (TBSA)">
        <dl className="report-rows">
          <div>
            <dt>Estimated burn size</dt>
            <dd>{report.tbsa != null ? `${formatPercent(report.tbsa)}% of the body` : "—"}</dd>
          </div>
          <div>
            <dt>Chart used</dt>
            <dd>{chart.label}</dd>
          </div>
          {report.areas.map((area) => (
            <div key={area.id}>
              <dt>{chart.areaById[area.id]?.label ?? area.id}</dt>
              <dd>
                {formatPercent(area.percent)}%
                {area.palms != null && (
                  <span className="report-palms">
                    {" "}
                    · {area.palms} {area.palms === 1 ? "palm" : "palms"}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
        {report.areas.length > 0 ? (
          <div className="report-body-map">
            <BodyMap
              variant={isChildChart(chart) ? "child" : "adult"}
              chart={chart}
              marks={marks}
              counted
              readOnly
            />
            <p className="report-map-key">
              <span className="report-key is-whole" aria-hidden="true" /> Whole area
              <span className="report-key is-palms" aria-hidden="true" /> Part of it (palms)
            </p>
          </div>
        ) : (
          <p className="report-pending">No body map was saved with this report.</p>
        )}
      </ReportSection>

      {/* ----- Photo ----- */}
      <ReportSection title="Burn photo">
        {report.hasPhoto ? (
          <div className="report-images">
            <figure>
              <img src={`/api/assessments/${encodeURIComponent(report.id)}/photo`} alt="Uploaded burn photo" />
              <figcaption>Uploaded photo</figcaption>
            </figure>
          </div>
        ) : (
          <p className="report-pending">No photo was saved with this report.</p>
        )}
      </ReportSection>

      {children}

      {/* ----- Change history ----- */}
      {report.edits.length > 0 && (
        <ReportSection title="Change history">
          <ul className="report-history">
            {report.edits.map((edit, index) => (
              <li key={`${edit.editedAt}-${edit.field}-${index}`}>
                <span className="report-history-when">
                  {niceDateTime(edit.editedAt)} · {edit.editedBy}
                </span>
                <span>
                  <strong>{edit.field}:</strong> {readable(edit.field, edit.oldValue)} → {readable(edit.field, edit.newValue)}
                </span>
              </li>
            ))}
          </ul>
        </ReportSection>
      )}

      <footer className="report-foot">
        BurnCare supports, but does not replace, a clinician&apos;s judgment or a burn unit consultation. Referral
        rules follow the British Burn Association referral thresholds.
      </footer>
    </article>
  );
}

export function ReportSection({ title, children }) {
  return (
    <section className="report-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

/* =====================================================================
   EDIT: the same questions and body map, filled with the saved answers
   ===================================================================== */
function ReportEditor({ report, onCancel, onSaved }) {
  const [emergency, setEmergency] = useState({ ...report.emergency });
  const [form, setForm] = useState({ ...report.form, conditions: [...report.form.conditions] });
  const [initialMarks] = useState(() => marksFromAreas(report.areas, report.form.age));
  const [tbsa, setTbsa] = useState(null); // latest result from the body map
  const [problem, setProblem] = useState("");
  const [saving, setSaving] = useState(false);

  const child = isChild(form.age);
  const answer = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const toggleCondition = (option) =>
    setForm((old) => {
      let list;
      if (option === "None") list = old.conditions.includes("None") ? [] : ["None"];
      else if (old.conditions.includes(option)) list = old.conditions.filter((c) => c !== option);
      else list = [...old.conditions.filter((c) => c !== "None"), option];
      return { ...old, conditions: list };
    });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!form.conditions.length) return setProblem("Please choose the long-term conditions (or None).");
    if (child && !form.childUnwell) return setProblem("Please answer whether the child seems unwell or has a fever.");
    if (!tbsa?.breakdown.length) return setProblem("Please mark the burned areas on the body map.");

    setSaving(true);
    setProblem("");
    try {
      const bodyMap = tbsa.breakdown.map(({ id, method, palms, touched }) => ({ id, method, palms, touched }));
      const data = await api(`/api/assessments/${encodeURIComponent(report.id)}`, {
        method: "PATCH",
        body: {
          emergency,
          form: { ...form, childUnwell: child ? form.childUnwell : "" },
          bodyMap,
          updatedAt: report.updatedAt,
        },
      });
      onSaved(data.report);
    } catch (error) {
      setProblem(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="guest-page">
      <div className="guest-container">
        <header className="guest-header">
          <div>
            <h1>Edit report</h1>
            <p className="guest-subtitle">
              {report.id} · Changes are kept in the report&apos;s change history.
            </p>
          </div>
        </header>

        <form className="guest-panel" onSubmit={handleSubmit} noValidate>
          {/* ----- Emergency check ----- */}
          <section className="guest-step">
            <div className="guest-step-head">
              <span className="guest-step-label">Emergency check</span>
              <h2 className="guest-step-title">Three quick safety questions</h2>
            </div>
            <div className="field-grid">
              {EMERGENCY_QUESTIONS.map((q) => (
                <Choice
                  key={q.key}
                  label={q.label}
                  options={q.options}
                  value={emergency[q.key]}
                  onChoose={(value) => setEmergency((old) => ({ ...old, [q.key]: value }))}
                />
              ))}
            </div>
          </section>

          {/* ----- About the burn ----- */}
          <section className="guest-step">
            <div className="guest-step-head">
              <span className="guest-step-label">Step 1</span>
              <h2 className="guest-step-title">About the burn</h2>
            </div>
            <div className="field-grid">
              <Choice label="How old is the patient?" options={AGE_GROUPS} value={form.age} onChoose={(v) => answer("age", v)} chips />
              <Choice label="What caused the burn?" options={BURN_CAUSES} value={form.cause} onChoose={(v) => answer("cause", v)} chips />
              <Choice
                label="Does the burn go all the way around a limb, neck or chest?"
                options={["Yes", "No", "Not sure"]}
                value={form.circumferential}
                onChoose={(v) => answer("circumferential", v)}
              />
              <Choice label="Long-term conditions?" options={CONDITIONS} value={form.conditions} onChoose={toggleCondition} chips multiple />
              <Choice
                label="Has the burn lasted over 2 weeks without healing?"
                options={["Yes", "No"]}
                value={form.notHealed}
                onChoose={(v) => answer("notHealed", v)}
              />
              {child && (
                <Choice
                  label="Does the child seem unwell or feverish?"
                  options={["Yes", "No", "Not sure"]}
                  value={form.childUnwell}
                  onChoose={(v) => answer("childUnwell", v)}
                />
              )}
            </div>
          </section>

          {/* ----- Body map ----- */}
          <section className="guest-step">
            <div className="guest-step-head">
              <span className="guest-step-label">Step 2</span>
              <h2 className="guest-step-title">Where is the burn?</h2>
            </div>
            <p className="guest-step-note">
              Your saved areas are already marked. Changing the age between a child and an adult starts the body map
              again, because the charts are different.
            </p>
            <TbsaCalculator age={AGE_IN_YEARS[form.age]} depth={null} onChange={setTbsa} initialMarks={initialMarks} />
          </section>

          <div className="guest-submit">
            {problem && (
              <p className="field-error" role="alert">
                {problem}
              </p>
            )}
            <div className="report-edit-actions">
              <button type="button" className="button button-outline" onClick={onCancel} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="button button-primary" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
            <p>The photo stays the same.</p>
          </div>
        </form>
      </div>
    </section>
  );
}

// One question with answer buttons (same look as the assessment).
//   chips    → pill buttons (long lists); otherwise a Yes/No switch
//   multiple → several answers can be chosen (value is a list)
function Choice({ label, options, value, onChoose, chips, multiple }) {
  const selected = (option) => (multiple ? value.includes(option) : value === option);
  return (
    <div className="field" role="group" aria-label={label}>
      <span className="field-label">{label}</span>
      <div
        className={`choices ${chips ? "choices-chips" : "choices-segmented"}`}
        style={chips ? undefined : { gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
      >
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={selected(option) ? "is-selected" : ""}
            aria-pressed={selected(option)}
            onClick={() => onChoose(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
      <path d="M8 2L4 6l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default ReportPage;