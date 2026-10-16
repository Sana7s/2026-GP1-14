/* =====================================================================
   BurnCare — pages/HomePage.jsx
   ---------------------------------------------------------------------
   The Home page (address: /).
   ===================================================================== */

import { useRef } from "react";
import { Link } from "react-router-dom";
import { STEPS, FEATURES } from "../content.js";
import { Reveal, useScrollProgress, heroProgress, statementProgress } from "../components/animations.jsx";
import { Chevron } from "../components/Chevron.jsx";

/* =====================================================================
   5. HOME PAGE
   ===================================================================== */
function HomePage({ content }) {
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
            AI-assisted burn assessment
          </p>
          <h1 className="hero-title">{content.tagline}</h1>
          <p className="hero-subtitle">{content.heroSubtitle}</p>
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
      <ScrollStatement eyebrow="Why BurnCare" text={content.homeDescription} />

      {/* ---------- HOW IT WORKS: three numbered steps ---------- */}
      <section className="section">
        <div className="section-inner">
          <Reveal className="section-heading">
            <p className="eyebrow">How it works</p>
            <h2>Three steps to a clearer picture.</h2>
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
            <h2>Everything you need for a first assessment.</h2>
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
                No account needed. Upload a photo, enter the details, and download
                your report as a PDF.
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
                Patients save reports, ask the wound-care assistant questions, and
                track recovery. Healthcare staff review cases securely.
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
            BurnCare does not diagnose burns, prescribe treatment, or decide on
            surgery. When the AI is unsure, it says so and recommends seeing a
            healthcare professional.
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
    // Gauge = urgency
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
