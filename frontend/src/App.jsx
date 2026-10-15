/* =====================================================================
   BurnCare — App.jsx
   ---------------------------------------------------------------------
   This one file builds every page of the BurnCare website:

     1. Page content ........ all the text shown on the site
     2. App ................. decides which page to show for each address
     3. Animation helpers ... small tools that make things fade in on scroll
     4. Layout .............. the top bar and footer shared by every page
     5. Home page
     6. About Us page
     

   How React works in one sentence: each "function" below that starts with
   a capital letter (like HomePage) is a *component* — a reusable piece of
   the page that returns HTML-like code (called JSX).
   ===================================================================== */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Link, // A link to another page of our site (no full page reload)
  NavLink, // Same as Link, but knows when its page is the one being viewed
  Route, // Connects one web address (like "/about") to one page
  Routes, // Holds all the Route items and shows the matching one
  useLocation, // Tells us which address the visitor is on right now
} from "react-router-dom";

/* =====================================================================
   1. PAGE CONTENT
   ---------------------------------------------------------------------
   All the text for the Home and About pages lives here, written from the
   BurnCare Sprint-0 report. If the Flask server is running, it can send
   new text that replaces these values (see the App component below).
   ===================================================================== */
const DEFAULT_CONTENT = {
  brandName: "BurnCare",

  // The slogan: the big headline on the Home page.
  tagline: "Know the burn. Act in time.",

  // The short line under the slogan.
  heroSubtitle:
    "Upload a photo of a burn, answer six quick questions, and get an AI-assisted estimate of burn depth and urgency in moments.",

  // The large sentence that lights up word-by-word on the Home page.
  homeDescription:
    "A burn's outcome is largely decided in the first 24 to 48 hours. BurnCare combines a burn photo with key clinical details to estimate burn depth and urgency, so the right care can start sooner.",

  // The opening paragraph of the About page.
  aboutIntro:
    "BurnCare is an AI-powered burn assessment and triage platform. It analyzes a photo of a burn together with key clinical information to estimate burn depth and surgical urgency, helping patients and healthcare staff make timely, informed care decisions wherever a burn occurs.",


  vision:
    "To bring specialist-level burn assessment to wherever a burn happens, from homes and rural communities to emergency rooms without a dedicated burn unit, so every patient reaches the right care in time.",

  mission:
    "To provide patients and healthcare staff with fast, accessible, and explainable burn assessment by combining AI image analysis with clinical information, supporting accurate triage and timely referral to surgical care.",

  // The project supervisor, shown first in the "Meet the team" row.
  supervisor: {
    id: "supervisor",
    name: "Dr. Lama Alzaben",
    role: "Supervisor & Product Owner",
    bio: "Department of Information Technology, King Saud University. Guides the BurnCare team and sets the product direction.",
  },

  // The four developers.
  developers: [
    {
      id: 1,
      name: "Sana Aljaber",
      role: "Project Leader & Developer",
      bio: "Leads the BurnCare project and develops the platform and its features.",
    },
    {
      id: 2,
      name: "Lana Alhussaini",
      role: "Scrum Master & Developer",
      bio: "Leads the team's Scrum process and develops the BurnCare platform.",
    },
    {
      id: 3,
      name: "Shatha Alharthi",
      role: "Developer",
      bio: "Software developer on the BurnCare team, building the platform and its features.",
    },
    {
      id: 4,
      name: "Reema Al-Saud",
      role: "Developer",
      bio: "Software developer on the BurnCare team, building the platform and its features.",
    },
  ],
};

// The three steps of an assessment (Home page, "How it works").
const STEPS = [
  {
    title: "Upload a photo",
    text: "Take or upload a clear photo of the burn from your phone or computer.",
  },
  {
    title: "Add six details",
    text: "Age, pain level (0–10), cause of the burn, its location, time since injury, and diabetes status. Type them or say them out loud.",
  },
  {
    title: "Get your report",
    text: "See the estimated burn depth, urgency level, confidence score, and a heatmap that explains the result.",
  },
];

// The six main features (Home page, "What BurnCare does").
const FEATURES = [
  {
    icon: "depth",
    title: "Burn depth estimate",
    text: "A deep-learning model reads the photo together with your clinical details to estimate how deep the burn is.",
  },
  {
    icon: "triage",
    title: "Urgency triage",
    text: "Every result is classified as Routine, Urgent, or Emergency to help decide how quickly care is needed.",
  },
  {
    icon: "body",
    title: "Body map (TBSA)",
    text: "Tap the burned areas on a front-and-back body diagram to estimate the Total Body Surface Area affected.",
  },
  {
    icon: "heatmap",
    title: "Heatmap explanations",
    text: "A colour-coded Grad-CAM heatmap shows which parts of the photo influenced the AI's prediction.",
  },
  {
    icon: "voice",
    title: "Voice entry",
    text: "Enter clinical details by speaking instead of typing, which helps when hands are busy.",
  },
  {
    icon: "report",
    title: "PDF reports",
    text: "Download your assessment as a PDF to share with a doctor or healthcare provider.",
  },
];

// The links in the top bar. "to" is the web address of each page.
const NAV_ITEMS = [
  { label: "Home", to: "/" },
  { label: "Guest", to: "/guest" },
  { label: "About Us", to: "/about" },
  { label: "Register", to: "/register" },
  { label: "Login", to: "/login" },
];

/* =====================================================================
   2. APP — the starting point of the website
   ===================================================================== */
function App() {
  // "content" holds the page text. It starts as DEFAULT_CONTENT.
  const [content, setContent] = useState(DEFAULT_CONTENT);

  // When the site first opens, ask the Flask server for updated text.
  // If Flask is off, nothing happens and the default text above is shown.
  useEffect(() => {
    let isCurrent = true;

    fetch("/api/site-content")
      .then((response) => {
        if (!response.ok) throw new Error("The content API is unavailable.");
        return response.json();
      })
      .then((data) => {
        // Merge: any field Flask sends replaces the matching default field.
        if (isCurrent) setContent({ ...DEFAULT_CONTENT, ...data });
      })
      .catch(() => {
        // Flask is not running — keep the default text.
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  // Choose which page to show based on the web address.
  return (
    <SiteLayout brandName={content.brandName}>
      <Routes>
        <Route path="/" element={<HomePage content={content} />} />
        <Route path="/about" element={<AboutPage content={content} />} />
        <Route path="/guest" element={<ComingSoonPage title="Guest assessment" />} />
        <Route path="/register" element={<ComingSoonPage title="Create an account" />} />
        <Route path="/login" element={<ComingSoonPage title="Log in" />} />
        {/* "*" means "any other address" — shows a not-found page. */}
        <Route path="*" element={<ComingSoonPage title="Page not found" />} />
      </Routes>
    </SiteLayout>
  );
}

/* =====================================================================
   3. ANIMATION HELPERS
   ===================================================================== */

// Returns true if the visitor asked their device for less motion
// (an accessibility setting). We then switch animations off.
function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

// <Reveal> wraps any block so it gently fades and slides up the first time
// it scrolls into view. "delay" (in milliseconds) lets items appear one
// after another instead of all at once.
function Reveal({ as: Tag = "div", className = "", delay = 0, style, children, ...rest }) {
  const ref = useRef(null); // a pointer to the real HTML element
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    // No animation wanted (or very old browser)? Show it straight away.
    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      setVisible(true);
      return undefined;
    }

    // IntersectionObserver is a browser tool that tells us when an element
    // enters the screen. When it does, we mark it visible and stop watching.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      {...rest}
      ref={ref}
      // The CSS class "is-visible" triggers the fade-in (see styles.css).
      className={`reveal${visible ? " is-visible" : ""}${className ? ` ${className}` : ""}`}
      style={{ "--reveal-delay": `${delay}ms`, ...style }}
    >
      {children}
    </Tag>
  );
}

// Measures how far the visitor has scrolled through an element and stores
// it as a number from 0 to 1 in the CSS variable "--p". The CSS then uses
// that number to animate things (for example, words lighting up).
function useScrollProgress(ref, compute, reducedValue = 1) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    if (prefersReducedMotion()) {
      node.style.setProperty("--p", String(reducedValue));
      return undefined;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = node.getBoundingClientRect(); // element's position on screen
      const value = compute(rect, window.innerHeight);
      // Keep the number between 0 and 1.
      node.style.setProperty("--p", Math.min(1, Math.max(0, value)).toFixed(4));
    };
    // requestAnimationFrame makes sure we update at most once per screen
    // refresh, which keeps scrolling smooth.
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ref, compute, reducedValue]);
}

// Formulas for useScrollProgress:
// heroProgress: 0 at the top of the page, 1 once the hero is scrolled past.
const heroProgress = (rect) => -rect.top / Math.max(rect.height, 1);
// statementProgress: 0 when the block enters the screen, 1 when it is
// roughly in the middle of the screen.
const statementProgress = (rect, vh) =>
  (vh * 0.88 - rect.top) / (vh * 0.42 + rect.height / 2);

/* =====================================================================
   4. LAYOUT — the top bar and footer that appear on every page
   ===================================================================== */
function SiteLayout({ brandName, children }) {
  const [menuOpen, setMenuOpen] = useState(false); // phone menu open?
  const [scrolled, setScrolled] = useState(false); // page scrolled down?
  const location = useLocation();

  // Each time the visitor changes page: close the phone menu and jump to
  // the top of the new page.
  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Add a soft shadow under the top bar once the visitor scrolls down.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // While the phone menu is open: stop the page behind it from scrolling,
  // close it with the Escape key, and close it if the window gets wider.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event) => event.key === "Escape" && setMenuOpen(false);
    const onResize = () => window.innerWidth > 833 && setMenuOpen(false);
    document.body.classList.add("menu-locked");
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.classList.remove("menu-locked");
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [menuOpen]);

  // The name of the current page, shown in the footer ("BurnCare › About Us").
  const pageName =
    NAV_ITEMS.find((item) => item.to === location.pathname)?.label ?? "BurnCare";

  return (
    <div className={`site-shell${menuOpen ? " has-menu-open" : ""}`}>
      {/* Hidden link for keyboard users to skip straight to the content. */}
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      {/* ---------- TOP BAR: logo | page links | login + register ---------- */}
      <header className={`site-header${scrolled ? " is-scrolled" : ""}`}>
        <div className="nav-wrap">
          {/* Logo + name. Clicking it goes back to the Home page. */}
          <Link className="brand" to="/" aria-label={`${brandName} home`}>
            <img className="brand-logo" src="/burncare-logo.png" alt="" width="36" height="38" />
            <span className="brand-name">{brandName}</span>
          </Link>

          {/* Main page links (hidden on phones; the menu button shows them). */}
          <nav className="primary-nav" aria-label="Main navigation">
            {NAV_ITEMS.slice(0, 3).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                // "is-active" underlines the link of the page we are on.
                className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Account buttons on the right. */}
          <div className="nav-actions">
            <NavLink
              to="/login"
              className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}
            >
              Login
            </NavLink>
            <Link className="button button-primary button-small" to="/register">
              Register
            </Link>
          </div>

          {/* Menu button (only visible on phones and small tablets).
              Its two lines turn into an "X" when the menu is open. */}
          <button
            className="menu-toggle"
            type="button"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
          </button>
        </div>
      </header>

      {/* ---------- PHONE MENU: full-screen list of all links ---------- */}
      <nav
        id="mobile-navigation"
        className={`mobile-menu${menuOpen ? " is-open" : ""}`}
        aria-label="Mobile navigation"
        aria-hidden={!menuOpen}
      >
        <ul>
          {NAV_ITEMS.map((item, index) => (
            // "--i" is the item's position; CSS uses it so the links
            // appear one after another.
            <li key={item.to} style={{ "--i": index }}>
              <NavLink
                to={item.to}
                end={item.to === "/"}
                tabIndex={menuOpen ? 0 : -1}
                className={({ isActive }) => `mobile-link${isActive ? " is-active" : ""}`}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <p className="mobile-menu-note" style={{ "--i": NAV_ITEMS.length }}>
          Preliminary support—not a substitute for professional care.
        </p>
      </nav>

      {/* ---------- PAGE CONTENT ---------- */}
      <main id="main-content">
        {/* "key" makes React rebuild this box on every page change, which
            replays the fade-in animation. */}
        <div className="page-transition" key={location.pathname}>
          {children}
        </div>
      </main>

      <SiteFooter brandName={brandName} pageName={pageName} />
    </div>
  );
}

// The footer at the bottom of every page.
function SiteFooter({ brandName, pageName }) {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        {/* Medical-safety note, taken from the project scope. */}
        <div className="footer-fineprint">
          <p>
            {brandName} is a clinical decision-support tool. It does not diagnose
            burns, prescribe treatment, or decide whether surgery is required.
          </p>
          <p>
            Urgent and emergency results should always be reviewed by a qualified
            healthcare professional. In an emergency, contact your local emergency
            services.
          </p>
        </div>

        {/* "You are here" line: logo › current page. */}
        <div className="footer-breadcrumb">
          <Link to="/" aria-label={`${brandName} home`}>
            <img src="/burncare-logo.png" alt="" width="18" height="19" />
          </Link>
          <span aria-hidden="true">›</span>
          <span>{pageName}</span>
        </div>

        {/* Link columns. */}
        <div className="footer-directory">
          <div>
            <h3>Explore</h3>
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/about">About Us</Link></li>
            </ul>
          </div>
          <div>
            <h3>Get started</h3>
            <ul>
              <li><Link to="/guest">Guest assessment</Link></li>
              <li><Link to="/register">Create an account</Link></li>
              <li><Link to="/login">Log in</Link></li>
            </ul>
          </div>
          <div>
            <h3>The project</h3>
            <ul>
              <li><Link to="/about">Vision &amp; mission</Link></li>
              <li><Link to="/about">Meet the team</Link></li>
            </ul>
          </div>
        </div>

        <div className="footer-legal">
          <span>© {new Date().getFullYear()} {brandName} · King Saud University</span>
          <span>Preliminary support—not a substitute for professional care.</span>
        </div>
      </div>
    </footer>
  );
}

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

// The small ">" arrow used after text links.
function Chevron() {
  return (
    <svg className="chevron" viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
      <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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

/* =====================================================================
   6. ABOUT US PAGE
   ===================================================================== */
function AboutPage({ content }) {
  // Use up to four developers; fall back to the defaults if Flask sends
  // something that is not a list.
  const developers = Array.isArray(content.developers)
    ? content.developers.slice(0, 4)
    : DEFAULT_CONTENT.developers;

  // The full team: the supervisor first, then the developers.
  const supervisor = content.supervisor?.name ? content.supervisor : DEFAULT_CONTENT.supervisor;
  const team = [supervisor, ...developers];

  return (
    <div className="about-page">
      {/* ---------- INTRO ---------- */}
      <section className="about-hero">
        <h1>About {content.brandName}</h1>
        <p className="about-lead">{content.aboutIntro}</p>
      </section>

      {/* ---------- VISION & MISSION: two large tiles ---------- */}
      <section className="purpose-section" aria-label="BurnCare vision and mission">
        <div className="purpose-grid">
          <Reveal as="article" className="purpose-tile purpose-vision">
            <span className="purpose-number" aria-hidden="true">01</span>
            <span className="tile-kicker">01 / Our vision</span>
            <h2>Our Vision</h2>
            <p>{content.vision}</p>
          </Reveal>
          <Reveal as="article" className="purpose-tile purpose-mission" delay={120}>
            <span className="purpose-number" aria-hidden="true">02</span>
            <span className="tile-kicker">02 / Our mission</span>
            <h2>Our Mission</h2>
            <p>{content.mission}</p>
          </Reveal>
        </div>
      </section>

      {/* ---------- TEAM: swipeable cards (supervisor + developers) ---------- */}
      <DeveloperCarousel developers={team} />
    </div>
  );
}

// Takes a name like "Sana Aljaber" and returns its initials: "SA".
// Titles such as "Dr." are skipped, so "Dr. Lama Alzaben" becomes "LA".
function initialsFor(name, index) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter((part) => part && !/^(dr|prof)\.?$/i.test(part));
  if (!parts.length) return String(index + 1).padStart(2, "0");
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

// A row of team cards you can swipe sideways (or move with the arrow buttons).
function DeveloperCarousel({ developers }) {
  const trackRef = useRef(null); // the scrolling row
  const [canPrev, setCanPrev] = useState(false); // can we go left?
  const [canNext, setCanNext] = useState(true); // can we go right?

  // Turn the arrow buttons on/off depending on the scroll position.
  const updateControls = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCanPrev(track.scrollLeft > 4);
    setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateControls();
    window.addEventListener("resize", updateControls);
    return () => window.removeEventListener("resize", updateControls);
  }, [updateControls, developers.length]);

  // Scroll the row by exactly one card to the left (-1) or right (+1).
  const scrollByCard = (direction) => {
    const track = trackRef.current;
    const card = track?.querySelector(".developer-card");
    if (!track || !card) return;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 16;
    track.scrollBy({
      left: direction * (card.offsetWidth + gap),
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  return (
    <section className="developers-section">
      <Reveal className="developers-heading">
        <div>
          <h2>Meet the team</h2>
        </div>
        <span className="team-count">{developers.length} team members</span>
      </Reveal>

      <div
        className="developer-track"
        ref={trackRef}
        onScroll={updateControls}
        tabIndex={0}
        aria-label="Team member profiles"
      >
        {developers.map((developer, index) => (
          <Reveal as="article" className="developer-card" key={developer.id ?? index} delay={index * 90}>
            <div className="developer-top">
              <span className={`developer-avatar developer-avatar-${index + 1}`} aria-hidden="true">
                {initialsFor(developer.name, index)}
              </span>
              <span className="developer-number">{String(index + 1).padStart(2, "0")}</span>
            </div>
            <div>
              <p className="developer-role">{developer.role}</p>
              <h3>{developer.name}</h3>
              <p className="developer-bio">{developer.bio}</p>
            </div>
          </Reveal>
        ))}
      </div>

      {/* Left / right arrow buttons. */}
      <div className="carousel-controls">
        <button type="button" className="carousel-button" onClick={() => scrollByCard(-1)} disabled={!canPrev} aria-label="Previous team member">
          <svg viewBox="0 0 12 12" width="13" height="13" aria-hidden="true">
            <path d="M8 2L4 6l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button type="button" className="carousel-button" onClick={() => scrollByCard(1)} disabled={!canNext} aria-label="Next team member">
          <svg viewBox="0 0 12 12" width="13" height="13" aria-hidden="true">
            <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </section>
  );
}

/* =====================================================================
   7. "COMING SOON" PAGE
   Used for Guest, Register and Login until those features are built.
   ===================================================================== */
function ComingSoonPage({ title }) {
  return (
    <section className="coming-soon">
      <div className="coming-soon-logo" aria-hidden="true">
        <span className="hero-glow" />
        <img src="/burncare-logo.png" alt="" width="84" height="90" />
      </div>
      <p className="eyebrow">Coming soon</p>
      <h1>{title}</h1>
      <p className="coming-soon-text">
        This page is being built as part of the next BurnCare sprint.
      </p>
      <div className="hero-actions">
        <Link className="button button-primary" to="/">
          Return home <span aria-hidden="true">→</span>
        </Link>
        <Link className="text-link" to="/about">
          About BurnCare <Chevron />
        </Link>
      </div>
    </section>
  );
}

export default App;
