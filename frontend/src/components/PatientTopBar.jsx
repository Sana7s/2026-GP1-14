/* =====================================================================
   BurnCare — components/PatientTopBar.jsx
   ---------------------------------------------------------------------
   The frame around every page a signed-in patient sees (/patient/...):
     1. Top bar: logo · Home · My reports · Recovery · Wound-care chat
                 · profile picture (opens a menu: My profile, Log out)
     2. The page itself (<Outlet /> = whichever patient page is open)
     3. Short footer with the medical disclaimer
   Styles: section "10. PATIENT PAGES" in styles.css.
   ===================================================================== */

import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { DEMO_PATIENT, initials } from "../patientData.js";

// Links in the top bar. "end" means "Home" is only active on /patient itself.
const PATIENT_LINKS = [
  { to: "/patient", label: "Home", end: true },
  { to: "/patient/reports", label: "My reports" },
  { to: "/patient/recovery", label: "Recovery" },
  { to: "/patient/chat", label: "Wound-care chat" },
];

function PatientTopBar() {
  const patient = DEMO_PATIENT;

  return (
    <div className="site-shell patient-shell">
      {/* ===== 1. Top bar ===== */}
      <header className="patient-header">
        <div className="patient-header-inner">
          <Link to="/patient" className="brand" aria-label="BurnCare home">
            <img className="brand-logo" src="/burncare-logo.png" alt="" width="36" height="38" />
            <span className="brand-name">BurnCare</span>
          </Link>

          <nav className="patient-nav" aria-label="Patient menu">
            {PATIENT_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => `patient-nav-link${isActive ? " is-active" : ""}`}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <AccountMenu patient={patient} />
        </div>
      </header>

      {/* ===== 2. The page ===== */}
      <main id="main-content" className="patient-main">
        <Outlet />
      </main>

      {/* ===== 3. Disclaimer ===== */}
      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-fineprint">
            <p>
              BurnCare is a clinical decision-support tool. It does not diagnose burns, prescribe treatment,
              or decide whether surgery is required.
            </p>
            <p>
              Urgent and emergency results should always be reviewed by a qualified healthcare professional.
              In an emergency, contact your local emergency services.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Profile picture + name. Clicking it opens a small menu with
// "My profile" and "Log out". Closes on outside click, Escape, or
// when the page changes.
function AccountMenu({ patient }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const location = useLocation();
  const onProfile = location.pathname.startsWith("/patient/profile"); // highlight the button there

  // Close the menu whenever the address changes.
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setOpen(false);
  }

  // Close on a click outside the menu, or on the Escape key.
  useEffect(() => {
    if (!open) return undefined;

    const handleClick = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKey = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div className="patient-account" ref={menuRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`account-button${open ? " is-open" : ""}${onProfile ? " is-active" : ""}`}
        onClick={() => setOpen((isOpen) => !isOpen)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="account-menu"
      >
        <span className="patient-avatar" aria-hidden="true">
          {initials(patient.name)}
        </span>
        <span className="patient-name">{patient.name}</span>
        <svg className="account-caret" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
          <path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="account-menu" id="account-menu" role="menu">
          <div className="account-menu-head">
            <span className="patient-avatar" aria-hidden="true">
              {initials(patient.name)}
            </span>
            <div>
              <p className="account-menu-name">{patient.name}</p>
              <p className="account-menu-email">{patient.email}</p>
            </div>
          </div>

          <Link to="/patient/profile" className="account-menu-item" role="menuitem">
            <PersonIcon />
            My profile
          </Link>
          {/* TODO (backend): also clear the saved login before leaving. */}
          <Link to="/login" className="account-menu-item account-menu-logout" role="menuitem">
            <LogoutIcon />
            Log out
          </Link>
        </div>
      )}
    </div>
  );
}

const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle {...line} cx="12" cy="8" r="3.5" />
      <path {...line} d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path {...line} d="M14 4.5H7.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H14" />
      <path {...line} d="M11 12h9M17 8.5l3.5 3.5-3.5 3.5" />
    </svg>
  );
}

export default PatientTopBar;