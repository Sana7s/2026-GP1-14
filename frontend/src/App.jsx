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
     7. Guest assessment page
     8. "Coming soon" page .. used for Register and Login for now

   
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
        <Route path="/guest" element={<GuestPage />} />
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
   7. GUEST ASSESSMENT PAGE
   Lets anyone start a burn assessment without an account, in 3 steps:
     Step 1 — answer six clinical questions (all choices, no typing)
     Step 2 — mark burned areas on a body map (TBSA, coming soon)
     Step 3 — upload a photo of the burn
   Every question and the photo are REQUIRED. If something is missing,
   "Assess case" shows a pop-up naming ONE missing question at a time.
   ===================================================================== */

// Answer choices for each clinical question.
const AGE_GROUPS = [
  "Under 1 year",
  "1 – 4 years",
  "5 – 9 years",
  "10 – 14 years",
  "15 – 17 years",
  "18 – 29 years",
  "30 – 44 years",
  "45 – 59 years",
  "60 – 74 years",
  "75 years or older",
];

const BURN_CAUSES = [
  "Flame or heat",
  "Hot liquid",
  "Chemical",
  "Electrical",
  "Radiation",
  "Other",
];

const BURN_LOCATIONS = [
  "Head or neck",
  "Face",
  "Chest",
  "Abdomen",
  "Back",
  "Arm",
  "Hand",
  "Leg",
  "Foot",
  "Genital area",
  "Major joint (shoulder, elbow, knee…)",
];

const INJURY_TIMES = [
  "Less than 1 hour",
  "1 to 6 hours",
  "6 to 24 hours",
  "24 to 48 hours",
  "More than 48 hours",
];

// Pain level choices: 0, 1, 2 … 10.
const PAIN_LEVELS = Array.from({ length: 11 }, (_, i) => i);

// The list of required answers. "label" is the name shown in the
// "missing answers" pop-up; "step" tells the visitor where to look.
const REQUIRED_QUESTIONS = [
  { key: "age", label: "Age group", step: 1 },
  { key: "diabetes", label: "Diabetes", step: 1 },
  { key: "pain", label: "Pain level", step: 1 },
  { key: "cause", label: "Cause of the burn", step: 1 },
  { key: "location", label: "Location of the burn", step: 1 },
  { key: "time", label: "Time since injury", step: 1 },
  { key: "photo", label: "Burn photo", step: 3 },
];

// The empty form: nothing is chosen until the visitor picks an answer.
const EMPTY_FORM = {
  age: "",
  diabetes: "",
  pain: "",
  cause: "",
  location: "",
  time: "",
};

// Photo rules: JPG or PNG, up to 10 MB.
const PHOTO_TYPES = ["image/jpeg", "image/png"];
const MAX_PHOTO_MB = 10;

function GuestPage() {
  const [form, setForm] = useState(EMPTY_FORM); // the visitor's answers
  const [photo, setPhoto] = useState(null); // the chosen photo file
  const [photoUrl, setPhotoUrl] = useState(""); // preview link for the photo
  const [photoProblem, setPhotoProblem] = useState(""); // wrong file type/size
  const [missing, setMissing] = useState([]); // keys of unanswered questions
  const [showAlert, setShowAlert] = useState(false); // show the pop-up?
  const [submitted, setSubmitted] = useState(false); // case accepted?
  const [dragging, setDragging] = useState(false); // photo dragged over box?
  const fileInputRef = useRef(null);

  // The pop-up shows ONE missing question at a time: the first in the list.
  const current = REQUIRED_QUESTIONS.find(({ key }) => missing.includes(key));

  // Only the question shown in the pop-up is outlined in red.
  const isMissing = (key) => current?.key === key;

  // Save one answer. If it was missing, remove it from the missing list.
  const answer = (key, value) => {
    setForm((old) => ({ ...old, [key]: value }));
    setMissing((old) => old.filter((item) => item !== key));
  };

  // When every missing answer has been filled, close the pop-up.
  useEffect(() => {
    if (showAlert && missing.length === 0) setShowAlert(false);
  }, [missing, showAlert]);

  // Free the memory used by an old photo preview.
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  // Check a chosen photo (type and size), then save it and show a preview.
  const choosePhoto = (file) => {
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) {
      setPhotoProblem("Please choose a JPG or PNG image.");
      return;
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      setPhotoProblem(`This photo is too large. Please choose one under ${MAX_PHOTO_MB} MB.`);
      return;
    }
    setPhotoProblem("");
    setPhoto(file);
    setPhotoUrl(URL.createObjectURL(file));
    setMissing((old) => old.filter((item) => item !== "photo"));
  };

  const removePhoto = () => {
    setPhoto(null);
    setPhotoUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Scroll to a question and give it a small shake so it is easy to spot.
  const goToQuestion = (key) => {
    const box = document.getElementById(`field-${key}`);
    if (!box) return;
    box.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "center",
    });
    box.classList.remove("is-flashing");
    void box.offsetWidth; // restarts the shake animation
    box.classList.add("is-flashing");
  };

  // Runs when "Assess case" is pressed.
  const handleSubmit = (event) => {
    event.preventDefault(); // stop the page from reloading

    // Make the list of everything not answered yet (in page order).
    const notAnswered = REQUIRED_QUESTIONS.filter(({ key }) =>
      key === "photo" ? !photo : form[key] === ""
    ).map(({ key }) => key);

    // Something is missing: show the pop-up and go to the first one.
    if (notAnswered.length) {
      setMissing(notAnswered);
      setShowAlert(true);
      goToQuestion(notAnswered[0]);
      return;
    }

    // Everything is answered — the case can be assessed.
    // TODO (backend): send `form` and `photo` to the Flask API here, then
    // show the AI result (burn depth, urgency, confidence and heatmap).
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };

  // Clear everything so the visitor can start a new case.
  const startOver = () => {
    setForm(EMPTY_FORM);
    setMissing([]);
    setShowAlert(false);
    removePhoto();
    setPhotoProblem("");
    setSubmitted(false);
  };

  // ---------- After a complete submission: confirmation screen ----------
  if (submitted) {
    return (
      <section className="guest-page">
        <div className="guest-done">
          <span className="guest-done-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28">
              <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <h1>Your case details are complete.</h1>
          <p className="guest-done-text">
            The AI assessment will appear here once the BurnCare model is
            connected. If the burn is severe or you are worried, contact a
            healthcare professional now.
          </p>

          {/* A short summary of the visitor's answers. */}
          <dl className="guest-summary">
            <div><dt>Age group</dt><dd>{form.age}</dd></div>
            <div><dt>Diabetes</dt><dd>{form.diabetes}</dd></div>
            <div><dt>Pain level</dt><dd>{form.pain} / 10</dd></div>
            <div><dt>Cause</dt><dd>{form.cause}</dd></div>
            <div><dt>Location</dt><dd>{form.location}</dd></div>
            <div><dt>Time since injury</dt><dd>{form.time}</dd></div>
          </dl>

          <div className="hero-actions">
            <button type="button" className="button button-primary" onClick={startOver}>
              Start a new case
            </button>
            <Link className="text-link" to="/register">
              Create an account to save reports <Chevron />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // ---------- The assessment form ----------
  return (
    <section className="guest-page">
      {/* ===== Pop-up: shows the next missing question (one at a time) ===== */}
      {showAlert && current && (
        <div className="missing-alert" role="alert" key={current.key}>
          <span className="missing-alert-icon" aria-hidden="true">!</span>
          <div className="missing-alert-body">
            <p className="missing-alert-title">Required question not answered</p>
            <p className="missing-alert-text">
              Please answer <strong>{current.label}</strong> in Step {current.step}{" "}
              before assessing the case.
            </p>
            <button
              type="button"
              className="missing-alert-go"
              onClick={() => goToQuestion(current.key)}
            >
              Go to question <Chevron />
            </button>
          </div>
          <button
            type="button"
            className="missing-alert-close"
            onClick={() => setShowAlert(false)}
            aria-label="Close message"
          >
            ×
          </button>
        </div>
      )}

      <div className="guest-container">
        {/* ===== Page title (left) + emergency notice (right) ===== */}
        <header className="guest-header">
          <div>
            <h1>Guest Assessment</h1>
            <p className="guest-subtitle">Assess a burn in three steps.</p>
          </div>

          {/* Emergency notice: always visible at the top of the page. */}
          <aside className="emergency-note" aria-label="Emergency information">
            <span className="emergency-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M12 3l9.5 17h-19L12 3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M12 10v4.5M12 17.5v.01" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <p>
              <strong>In an emergency</strong>
              If the burn is large, deep, on the face, or caused by electricity
              or chemicals, seek medical care right away.
            </p>
          </aside>
        </header>

        {/* noValidate: we show our own friendly messages instead of the browser's. */}
        <form onSubmit={handleSubmit} noValidate>
          {/* ===== STEP 1: clinical questions ===== */}
          <section className="guest-step">
            <StepHeader number={1} title="Clinical details" />

            <div className="field-grid">
              {/* Age group — drop-down list */}
              <Question id="age" label="Age group" missing={isMissing("age")} htmlFor="guest-age">
                <select
                  id="guest-age"
                  value={form.age}
                  onChange={(e) => answer("age", e.target.value)}
                  aria-invalid={isMissing("age")}
                >
                  <option value="">Choose an age group</option>
                  {AGE_GROUPS.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </Question>

              {/* Diabetes — Yes / No */}
              <Question id="diabetes" label="Do you have diabetes?" missing={isMissing("diabetes")}>
                <ChoiceButtons
                  name="diabetes"
                  options={["Yes", "No"]}
                  value={form.diabetes}
                  onChoose={answer}
                  variant="segmented"
                />
              </Question>

              {/* Location — drop-down list */}
              <Question id="location" label="Where is the burn?" missing={isMissing("location")} htmlFor="guest-location">
                <select
                  id="guest-location"
                  value={form.location}
                  onChange={(e) => answer("location", e.target.value)}
                  aria-invalid={isMissing("location")}
                >
                  <option value="">Choose a body area</option>
                  {BURN_LOCATIONS.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </Question>

              {/* Time since injury — drop-down list */}
              <Question id="time" label="When did it happen?" missing={isMissing("time")} htmlFor="guest-time">
                <select
                  id="guest-time"
                  value={form.time}
                  onChange={(e) => answer("time", e.target.value)}
                  aria-invalid={isMissing("time")}
                >
                  <option value="">Choose a time</option>
                  {INJURY_TIMES.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </Question>

              {/* Cause of the burn — choice buttons */}
              <Question id="cause" label="What caused the burn?" missing={isMissing("cause")} wide>
                <ChoiceButtons
                  name="cause"
                  options={BURN_CAUSES}
                  value={form.cause}
                  onChoose={answer}
                  variant="chips"
                />
              </Question>

              {/* Pain level — buttons from 0 to 10 */}
              <Question id="pain" label="Pain level" missing={isMissing("pain")} wide>
                <ChoiceButtons
                  name="pain"
                  options={PAIN_LEVELS}
                  value={form.pain}
                  onChoose={answer}
                  variant="scale"
                />
                <div className="pain-scale" aria-hidden="true">
                  <span>No pain</span>
                  <span>Worst pain</span>
                </div>
              </Question>
            </div>
          </section>

          {/* ===== STEP 2: TBSA body map (placeholder for now) ===== */}
          <section className="guest-step">
            <StepHeader number={2} title="Body map (TBSA)" badge="Coming soon" />
            {/* PLACEHOLDER: the interactive TBSA body map will go here. */}
            <div className="tbsa-placeholder" aria-hidden="true">
              <BodyOutline />
              <BodyOutline />
              <p>Front and back body map</p>
            </div>
          </section>

          {/* ===== STEP 3: photo upload ===== */}
          <section className="guest-step">
            <StepHeader number={3} title="Burn photo" />

            <div id="field-photo" className={`field${isMissing("photo") ? " is-missing" : ""}`}>
              {photoUrl ? (
                // A photo is chosen: show the preview with Change / Remove.
                <div className="photo-preview">
                  <img src={photoUrl} alt="Your uploaded burn photo" />
                  <div className="photo-preview-bar">
                    <span className="photo-name">{photo?.name}</span>
                    <div className="photo-actions">
                      <button type="button" className="text-link" onClick={() => fileInputRef.current?.click()}>
                        Change
                      </button>
                      <button type="button" className="text-link" onClick={removePhoto}>
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                // No photo yet: a box to click, or to drag a photo onto.
                <label
                  htmlFor="guest-photo"
                  className={`dropzone${dragging ? " is-dragging" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    choosePhoto(e.dataTransfer.files?.[0]);
                  }}
                >
                  <span className="dropzone-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="22" height="22">
                      <path d="M12 16V4M7 9l5-5 5 5M5 20h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="dropzone-title">Upload image here</span>
                  <span className="dropzone-hint">JPG or PNG, up to {MAX_PHOTO_MB} MB</span>
                </label>
              )}

              {/* The real file picker (hidden; the box above opens it). */}
              <input
                ref={fileInputRef}
                id="guest-photo"
                className="visually-hidden"
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => choosePhoto(e.target.files?.[0])}
              />
              {photoProblem && <p className="field-error">{photoProblem}</p>}
              {!photoProblem && isMissing("photo") && (
                <p className="field-error">Please upload a photo of the burn.</p>
              )}
            </div>
          </section>

          {/* ===== Assess case button ===== */}
          <div className="guest-submit">
            <button type="submit" className="button button-primary button-wide">
              Assess case
            </button>
            <p>Guest submissions are processed without being stored.</p>
          </div>
        </form>
      </div>
    </section>
  );
}

// The heading of each step: "Step X", the title, and an optional badge.
function StepHeader({ number, title, badge }) {
  return (
    <div className="guest-step-head">
      <span className="guest-step-label">Step {number}</span>
      <h2 className="guest-step-title">{title}</h2>
      {badge && <span className="soon-badge">{badge}</span>}
    </div>
  );
}

// One question box: the question text, the answer control (children),
// and a red "required" message when it is missing.
function Question({ id, label, missing, wide, htmlFor, children }) {
  const LabelTag = htmlFor ? "label" : "span";
  return (
    <div
      id={`field-${id}`}
      className={`field${wide ? " field-wide" : ""}${missing ? " is-missing" : ""}`}
      role={htmlFor ? undefined : "group"}
      aria-labelledby={htmlFor ? undefined : `label-${id}`}
    >
      <LabelTag className="field-label" id={`label-${id}`} htmlFor={htmlFor}>
        {label} <span className="required-mark" aria-hidden="true">*</span>
      </LabelTag>
      {children}
      {missing && <p className="field-error">This question is required.</p>}
    </div>
  );
}

// A row of answer buttons where only one can be chosen.
// variant: "segmented" (Yes/No switch), "scale" (0–10), or "chips" (pills).
function ChoiceButtons({ name, options, value, onChoose, variant }) {
  return (
    <div className={`choices choices-${variant}`} role="radiogroup">
      {options.map((option) => {
        const selected = value === option;
        return (
          <button
            type="button"
            key={option}
            role="radio"
            aria-checked={selected}
            className={selected ? "is-selected" : ""}
            onClick={() => onChoose(name, option)}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

// A simple body outline used in the TBSA placeholder.
function BodyOutline() {
  return (
    <svg viewBox="0 0 120 200" className="tbsa-figure">
      <circle cx="60" cy="22" r="14" />
      <rect x="40" y="40" width="40" height="66" rx="14" />
      <rect x="20" y="44" width="14" height="62" rx="7" />
      <rect x="86" y="44" width="14" height="62" rx="7" />
      <rect x="42" y="108" width="15" height="78" rx="7" />
      <rect x="63" y="108" width="15" height="78" rx="7" />
    </svg>
  );
}

/* =====================================================================
   8. "COMING SOON" PAGE
   Used for Register and Login until those features are built.
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
