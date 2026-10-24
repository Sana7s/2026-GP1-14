/* =====================================================================
   BurnCare — pages/PatientHomePage.jsx
   ---------------------------------------------------------------------
   The patient's home page (/patient). Same sections, in the same order,
   as the wireframe:
     1. Welcome + "Check a new burn" (Start assessment)
     2. My reports            |  3. Recovery tracking
     4. Wound-care chat
     5. First aid for a new burn
   Where the information comes from:
     - name           → the signed-in account (from PatientTopBar)
     - My reports     → Flask, GET /api/assessments/mine (database)
     - Recovery tracking → opens the Recovery page (TrackRecovery.jsx).
       Recovery NOTES come in Sprint 2 ("Add today's note" is switched off).
     - Wound-care chat → SPRINT 2. The card keeps its place and layout.
   Styles: section "10. PATIENT PAGES" in styles.css.
   ===================================================================== */

import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { Chevron } from "../components/Chevron.jsx";
import { api } from "../auth.js";
import { RESULT_LEVELS } from "../patientData.js";

const REPORTS_SHOWN = 3; // newest reports on the home page; "See all" shows the rest

// "23 Oct 2026, 14:40" (from Flask) → "23 Oct 2026"
const dayOnly = (text) => String(text || "").split(",")[0];

// Suggested questions under the chat box.
const CHAT_SUGGESTIONS = ["When should I see a doctor?", "How do I change a dressing?", "Signs of infection"];

function PatientHomePage() {
  const { account } = useOutletContext(); // the signed-in patient (PatientTopBar)
  const firstName = account.fullName.trim().split(/\s+/)[0];

  // null = still loading, "error" = couldn't load, otherwise the list from Flask.
  const [reports, setReports] = useState(null);

  // Load this patient's reports from the database once.
  useEffect(() => {
    let isCurrent = true;
    api("/api/assessments/mine")
      .then((data) => {
        if (isCurrent) setReports(data.assessments ?? []);
      })
      .catch(() => {
        if (isCurrent) setReports("error");
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <div className="patient-home">
      <div className="patient-page">
      {/* ===== 1. Check a new burn ===== */}
      <section className="patient-card patient-hero" aria-labelledby="hero-title">
        <div className="patient-hero-copy">
          <p className="patient-welcome">Welcome back, {firstName}</p>
          <h1 id="hero-title">Check a new burn</h1>
          <p className="patient-hero-text">
            Answer a few questions, mark the burn on a body map and add one photo. BurnCare tells you whether it
            needs a burn unit, a nearby clinic or hospital, or only first aid at home.
          </p>
          <div className="patient-hero-actions">
            <Link to="/patient/assessment" className="button button-primary">
              Start assessment <Chevron />
            </Link>
            <span className="patient-hero-time">
              <ClockIcon />
              About 2 minutes
            </span>
          </div>
        </div>
        <AssessmentIllustration />
      </section>

      <div className="patient-grid">
        {/* ===== 2. My reports ===== */}
        <section className="patient-card" aria-labelledby="reports-title">
          <div className="patient-card-head">
            <h2 id="reports-title">My reports</h2>
            <Link to="/patient/reports" className="patient-card-link">
              See all
            </Link>
          </div>

          {reports === null && <p className="patient-empty">Loading your reports…</p>}
          {reports === "error" && (
            <p className="patient-empty">We couldn&apos;t load your reports. Please refresh the page.</p>
          )}
          {Array.isArray(reports) && reports.length === 0 && (
            <p className="patient-empty">No reports yet. Your results will appear here after an assessment.</p>
          )}
          {Array.isArray(reports) && reports.length > 0 && (
            <ul className="report-list">
              {reports.slice(0, REPORTS_SHOWN).map((report) => {
                const level = RESULT_LEVELS[report.decision] ?? RESULT_LEVELS.pending;
                const date = dayOnly(report.createdAt);
                return (
                  <li key={report.id} className="report-row">
                    <span className={`report-dot tone-${level.tone}`} aria-hidden="true" />
                    <div className="report-info">
                      <p className="report-level">{level.label}</p>
                      <p className="report-meta">
                        {date} · {report.cause}
                      </p>
                    </div>
                    <Link
                      to={`/patient/reports/${report.id}`}
                      className="patient-card-link"
                      aria-label={`View report ${report.id} from ${date}`}
                    >
                      View
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="patient-note">Each report can be downloaded as a PDF to show a doctor.</p>
        </section>

        {/* ===== 3. Recovery tracking (notes come in Sprint 2) ===== */}
        <section className="patient-card" aria-labelledby="recovery-title">
          <div className="patient-card-head">
            <h2 id="recovery-title">Recovery tracking</h2>
            <Link to="/patient/recovery" className="patient-card-link">
              Open
            </Link>
          </div>

          <p className="recovery-day">
            Follow how your burn heals: add a photo and a short note every few days, and compare them over time.
          </p>

          <div className="recovery-photos">
            <RecoveryPhoto label="First photo" />
            <RecoveryPhoto label="Latest photo" />
            <button
              type="button"
              className="button button-secondary is-upcoming-button"
              disabled
              title="Recovery notes are coming in Sprint 2"
            >
              Add today&apos;s note · Sprint 2
            </button>
            <Link to="/patient/recovery" className="button button-secondary">
              Add a photo
            </Link>
          </div>

          <p className="patient-note patient-warning">
            Not healed after 2 weeks, or redder, smelly or feverish? See a burn unit.
          </p>
        </section>
      </div>

      {/* ===== 4. Wound-care chat ===== */}
      <WoundCareChat />

      {/* ===== 5. First aid ===== */}
      <section className="first-aid-strip" aria-labelledby="first-aid-title">
        <span className="first-aid-icon" aria-hidden="true">
          <DropIcon />
        </span>
        <div className="first-aid-copy">
          <h2 id="first-aid-title">First aid for a new burn</h2>
          <p>
            Cool it under cool running tap water for 20 minutes, within 3 hours. No ice, toothpaste or butter.
            Keep the person warm.
          </p>
        </div>
        <Link to="/patient/first-aid" className="text-link">
          Full first-aid guide <Chevron />
        </Link>
      </section>
      </div>
    </div>
  );
}

// Wound-care chat (Sprint 2): the same layout as the final chat box, but
// switched off, so the space is kept on the page.
function WoundCareChat() {
  return (
    <section className="patient-card is-upcoming" aria-labelledby="chat-title">
      <div className="patient-card-head">
        <h2 id="chat-title">Wound-care chat</h2>
        <span className="soon-badge">Coming in Sprint 2</span>
      </div>
      <p className="patient-card-text">
        Soon you can ask about dressings, cleaning, signs of infection or recovery here.
      </p>

      <div className="chat-suggestions">
        {CHAT_SUGGESTIONS.map((text) => (
          <button key={text} type="button" className="chat-chip" disabled>
            {text}
          </button>
        ))}
      </div>

      <div className="chat-form">
        <label className="visually-hidden" htmlFor="chat-question">
          Your question
        </label>
        <div className="text-input">
          <input id="chat-question" type="text" placeholder="Available in Sprint 2" disabled />
        </div>
        <button type="button" className="button button-dark" disabled>
          Ask
        </button>
      </div>
    </section>
  );
}

// One photo box. Shows the photo, or a placeholder with a caption
// (e.g. the entry date), or "not added yet".
function RecoveryPhoto({ label, src, caption }) {
  return (
    <figure className={`recovery-photo${src ? " has-photo" : ""}`}>
      {src ? (
        <img src={src} alt={label} />
      ) : (
        <span className="recovery-photo-empty" aria-hidden="true">
          <CameraIcon />
        </span>
      )}
      <figcaption>{src ? label : caption || `${label} — not added yet`}</figcaption>
    </figure>
  );
}

// Drawing for the hero card: a photo card and a body map with the burn
// area marked, joined by a dashed line.
function AssessmentIllustration() {
  return (
    <div className="patient-hero-visual" aria-hidden="true">
      <svg viewBox="0 0 300 220" className="hero-illustration">
        {/* Soft background blob */}
        <ellipse cx="160" cy="118" rx="128" ry="92" className="illus-blob" />

        {/* Body map (front view) */}
        <g className="illus-body">
          <circle cx="196" cy="44" r="15" />
          <rect x="174" y="64" width="44" height="64" rx="16" />
          <rect x="161" y="66" width="14" height="58" rx="7" transform="rotate(14 168 70)" />
          <rect x="217" y="66" width="14" height="58" rx="7" transform="rotate(-14 224 70)" />
          <rect x="176" y="124" width="17" height="70" rx="8.5" />
          <rect x="199" y="124" width="17" height="70" rx="8.5" />
        </g>

        {/* Marked burn area on the left forearm, with a pulse */}
        <circle cx="160" cy="108" r="14" className="illus-pulse" />
        <circle cx="160" cy="108" r="8" className="illus-mark" />

        {/* Dashed line from the photo to the marked area */}
        <path d="M110 126 C 128 126, 138 112, 151 110" className="illus-link" />

        {/* Photo card */}
        <g className="illus-photo">
          <rect x="34" y="92" width="80" height="94" rx="12" className="illus-photo-card" />
          <rect x="43" y="101" width="62" height="54" rx="7" className="illus-photo-frame" />
          <circle cx="60" cy="118" r="7" className="illus-photo-sun" />
          <path d="M43 148 l18-17 13 12 9-8 22 20 v0 a7 7 0 0 1 -7 0 H50 a7 7 0 0 1 -7 -7Z" className="illus-photo-hill" />
          <rect x="43" y="164" width="40" height="6" rx="3" className="illus-photo-line" />
          <rect x="43" y="174" width="26" height="6" rx="3" className="illus-photo-line" />
        </g>

        {/* Little check badge */}
        <g className="illus-check">
          <circle cx="252" cy="160" r="17" />
          <path d="M244 160.5l5.4 5.4L260 155" />
        </g>
      </svg>
    </div>
  );
}

/* ---------- Small icons ---------- */
const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <circle {...line} cx="12" cy="12" r="8.5" />
      <path {...line} d="M12 7.5V12l3 2" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24">
      <path {...line} d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.4-2h4.6l1.4 2h1.8A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5Z" />
      <circle {...line} cx="12" cy="12.5" r="3.5" />
    </svg>
  );
}

function DropIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22">
      <path {...line} d="M12 3.5s6 6.4 6 10.7a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5Z" />
      <path {...line} d="M9.2 14.6a2.9 2.9 0 0 0 2.6 2.6" />
    </svg>
  );
}

export default PatientHomePage;