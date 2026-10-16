/* =====================================================================
   BurnCare — components/Layout.jsx
   ---------------------------------------------------------------------
   The parts shared by every page: the top bar (with the phone menu)
   and the footer.
   ===================================================================== */

import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { NAV_ITEMS } from "../content.js";

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
    NAV_ITEMS.find(
      (item) =>
        item.to === location.pathname ||
        (item.to !== "/" && location.pathname.startsWith(`${item.to}/`))
    )?.label ?? "BurnCare";

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
        {/* "key" makes React rebuild this box on every page change (even
            when clicking a link to the page you're already on), which
            replays the fade-in animation and starts the page fresh. */}
        <div className="page-transition" key={location.key ?? location.pathname}>
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

export { SiteLayout };
