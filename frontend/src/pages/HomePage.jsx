/* =====================================================================
   BurnCare — pages/HomePage.jsx
   ---------------------------------------------------------------------
   The Home page (address: /).
   All the text shown on this page is written in this one file (in the
   "HOME PAGE TEXT" part just below), so you only need to edit here.
   ===================================================================== */

import { useRef } from "react";
import { Link } from "react-router-dom";
import { Reveal, useScrollProgress, heroProgress, statementProgress } from "../components/animations.jsx";
import { Chevron } from "../components/Chevron.jsx";

/* =====================================================================
   HOME PAGE TEXT — change the wording here
   ===================================================================== */

// The slogan, the line under it, and the "Why BurnCare" sentence.
const HOME_TEXT = {
  tagline: "Know the burn. Act in time.",
  heroSubtitle:
    "Answer a few quick questions, mark the burn on a body map, and add a photo. BurnCare tells you whether the burn needs no treatment, can be treated locally, or needs a burn unit.",
  homeDescription:
    "Many burns sent to burn units could be treated closer to home, while some serious burns are missed. BurnCare helps anyone decide, in minutes, where a burn should be treated.",
};

// The three steps of an assessment ("How it works").
const STEPS = [
  {
    title: "Check for emergencies",
    text: "BurnCare first asks three brief safety questions to identify urgent warning signs, and directs the user to emergency services when immediate help is needed.",
  },
  {
    title: "Describe the burn",
    text: "Answer a few questions about the patient and the burn, mark the burned areas on a body map, and upload a photo.",
  },
  {
    title: "Receive a recommendation",
    text: "A clear report recommends whether the burn requires no treatment, care at a local clinic, or transfer to a burn unit, and explains the reasons.",
  },
];

// The six main features ("What BurnCare does").
// "icon" picks the drawing used for each card (see FeatureIcon below).
const FEATURES = [
  {
    icon: "depth",
    title: "Burn depth check",
    text: "The AI looks at the burn photo to estimate whether it is superficial, partial thickness or full thickness.",
  },
  {
    icon: "triage",
    title: "Where to treat",
    text: "Every case receives one of three recommendations: no treatment needed, treat locally, or treat at a burn unit.",
  },
  {
    icon: "body",
    title: "Body map (TBSA)",
    text: "Tap the burned areas on a front-and-back body map to estimate how much of the body is burned (Total Body Surface Area).",
  },
  {
    icon: "heatmap",
    title: "Heatmap explanations",
    text: "A colour-coded heatmap shows which parts of the photo the AI focused on when judging the burn depth.",
  },
  {
    icon: "voice",
    title: "Voice entry",
    text: "Answer the questions by speaking instead of typing, which helps when your hands are busy helping the patient.",
  },
  {
    icon: "report",
    title: "PDF reports",
    text: "Download your report as a PDF to share with a doctor or a burn unit.",
  },
];

/* =====================================================================
   5. HOME PAGE
   ===================================================================== */
function HomePage() {
  // Track scrolling over the hero so the logo can zoom slightly.
  const heroRef = useRef(null);
  useScrollProgress(heroRef, heroProgress, 0);

  return (
    <div className="home-page">
      {/* ---------- HERO: slogan, short description, two buttons, logo ---------- */}
      <section className="hero" ref={heroRef}>
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="eyebrow-dot" />
            AI-assisted burn referral
          </p>
          <h1 className="hero-title">{HOME_TEXT.tagline}</h1>
          <p className="hero-subtitle">{HOME_TEXT.heroSubtitle}</p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/guest">
              Try a free assessment
            </Link>
            <Link className="text-link" to="/register">
              Create an account <Chevron />
            </Link>
          </div>
        </div>

        {/* Decorative logo with rings and a glow (hidden from screen readers). */}
        <div className="hero-visual" aria-hidden="true">
          <span className="ripple ripple-1" />
          <span className="ripple ripple-2" />
          <span className="ripple ripple-3" />
          <span className="hero-glow" />
          <img className="hero-logo" src="/burncare-logo.png" alt="" width="260" height="280" />
        </div>
      </section>

      {/* ---------- STATEMENT: words light up while scrolling ---------- */}
      <ScrollStatement eyebrow="Why BurnCare" text={HOME_TEXT.homeDescription} />

      {/* ---------- HOW IT WORKS: three numbered steps ---------- */}
      <section className="section">
        <div className="section-inner">
          <Reveal className="section-heading">
            <p className="eyebrow">How it works</p>
            <h2>Three steps to the right place of care.</h2>
          </Reveal>
          <ol className="steps">
            {STEPS.map((step, index) => (
              <Reveal as="li" className="step" key={step.title} delay={index * 100}>
                <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- FEATURES: six cards with icons ---------- */}
      <section className="section section-tinted">
        <div className="section-inner">
          <Reveal className="section-heading">
            <p className="eyebrow">What BurnCare does</p>
            <h2>Everything you need to decide where a burn is treated.</h2>
          </Reveal>
          <div className="feature-grid">
            {FEATURES.map((feature, index) => (
              <Reveal as="article" className="feature-card" key={feature.title} delay={(index % 3) * 90}>
                <span className="feature-icon" aria-hidden="true">
                  <FeatureIcon name={feature.icon} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- TWO TILES: the two ways to start (from the wireframe) ---------- */}
      <section className="tile-section" aria-label="Ways to get started">
        <div className="tile-grid">
          {/* Tile 1 — guest assessment */}
          <Reveal as="article" className="tile tile-coral">
            <div className="tile-copy">
              <span className="tile-kicker">For everyone · 01</span>
              <h2>Try a free assessment.</h2>
              <p>
                No account needed. Answer a few questions, add a photo, and find
                out where the burn should be treated.
              </p>
              <div className="tile-actions">
                <Link className="button button-light" to="/guest">
                  Continue as guest
                </Link>
              </div>
            </div>
            {/* Simple phone drawing made with CSS (no real data). */}
            <div className="tile-visual device" aria-hidden="true">
              <div className="device-screen">
                <img src="/burncare-logo.png" alt="" width="44" height="47" />
                <span className="skeleton skeleton-title" />
                <span className="skeleton" />
                <span className="skeleton skeleton-short" />
                <span className="device-steps">
                  <i className="is-done" />
                  <i className="is-done" />
                  <i />
                </span>
                <span className="skeleton-button" />
              </div>
            </div>
          </Reveal>

          {/* Tile 2 — create an account */}
          <Reveal as="article" className="tile tile-ink" delay={120}>
            <div className="tile-copy">
              <span className="tile-kicker">Patients &amp; staff · 02</span>
              <h2>Create an account.</h2>
              <p>
                Patients save reports, ask the burn-care assistant questions, and
                track healing. Healthcare staff review shared cases and ask burn
                specialists for advice.
              </p>
              <div className="tile-actions">
                <Link className="button button-primary" to="/register">
                  Register
                </Link>
                <Link className="text-link text-link-light" to="/login">
                  Log in <Chevron />
                </Link>
              </div>
            </div>
            {/* Stacked cards drawing = "saved reports" (no real data). */}
            <div className="tile-visual stack" aria-hidden="true">
              <span className="stack-card stack-card-3" />
              <span className="stack-card stack-card-2" />
              <span className="stack-card stack-card-1">
                <span className="stack-check">
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="stack-lines">
                  <span className="skeleton skeleton-dark" />
                  <span className="skeleton skeleton-dark skeleton-short" />
                </span>
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- SAFETY: the medical boundary of the project ---------- */}
      <section className="safety-section">
        <Reveal className="safety-inner">
          <span className="safety-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="34" height="34">
              <path d="M24 4l16 6v12c0 10.5-6.8 18.6-16 22-9.2-3.4-16-11.5-16-22V10l16-6z" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" />
              <path d="M24 16v14M17 23h14" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
            </svg>
          </span>
          <h2>Support for decisions, not a replacement for doctors.</h2>
          <p>
            BurnCare follows established burn referral guidelines to suggest where
            a burn should be treated. It does not diagnose burns or prescribe
            treatment, and when in doubt it always recommends specialist care.
          </p>
          <Link className="text-link" to="/about">
            Learn about the project <Chevron />
          </Link>
        </Reveal>
      </section>
    </div>
  );
}

// A large sentence where each word brightens as the visitor scrolls.
// Each word gets its position number ("--i"); the CSS compares it with the
// scroll progress ("--p") to decide how bright the word should be.
function ScrollStatement({ eyebrow, text }) {
  const ref = useRef(null);
  useScrollProgress(ref, statementProgress, 1);
  const words = String(text || "").split(/\s+/).filter(Boolean);

  return (
    <section className="statement" ref={ref} style={{ "--n": words.length }}>
      <div className="statement-inner">
        <p className="eyebrow">{eyebrow}</p>
        <p className="statement-text">
          {words.map((word, index) => (
            <span key={`${word}-${index}`} style={{ "--i": index }}>
              {word}{" "}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}

// Simple line icons for the feature cards, drawn with SVG.
function FeatureIcon({ name }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  const paths = {
    // Layers = skin depth
    depth: (
      <>
        <path {...common} d="M3 8l9-4 9 4-9 4-9-4z" />
        <path {...common} d="M3 12l9 4 9-4" />
        <path {...common} d="M3 16l9 4 9-4" />
      </>
    ),
    // Gauge = where to treat
    triage: (
      <>
        <path {...common} d="M4 17a8 8 0 1116 0" />
        <path {...common} d="M12 17l4-5" />
        <circle {...common} cx="12" cy="17" r="1.2" />
      </>
    ),
    // Person = body map
    body: (
      <>
        <circle {...common} cx="12" cy="4.5" r="2" />
        <path {...common} d="M7 8.5h10M12 8.5v6M12 14.5l-3 6M12 14.5l3 6" />
      </>
    ),
    // Target rings = heatmap focus
    heatmap: (
      <>
        <circle {...common} cx="12" cy="12" r="8" />
        <circle {...common} cx="12" cy="12" r="4.5" />
        <circle {...common} cx="12" cy="12" r="1.2" />
      </>
    ),
    // Microphone = voice entry
    voice: (
      <>
        <rect {...common} x="9" y="3" width="6" height="11" rx="3" />
        <path {...common} d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" />
      </>
    ),
    // Document = PDF report
    report: (
      <>
        <path {...common} d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
        <path {...common} d="M14 3v5h5M9 13h6M9 17h4" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" width="22" height="22">
      {paths[name]}
    </svg>
  );
}

export default HomePage;
