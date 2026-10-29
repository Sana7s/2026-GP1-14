/* =====================================================================
   BurnCare — components/StaffTopBar.jsx
   ---------------------------------------------------------------------
   The frame around every healthcare staff page (/staff/...). The same
   design as the patient pages (PatientTopBar.jsx), so the whole website
   looks like one product.
   It asks Flask who is signed in (GET /api/auth/me):
     - not signed in → /login
     - a patient or the admin → their own pages
     - healthcare staff → the staff pages. The account is passed to the
       page below (pages read it with useOutletContext()).
   Staff waiting for the admin's approval can only open Home and their
   profile; the other links are greyed out (the server checks it too).
   Parts:
     1. Top bar: logo · Home · New assessment · Reports · Consultations
                 · profile picture (menu: My profile, Log out)
     2. The page itself (<Outlet />)
     3. Short footer with the medical disclaimer
   Styles: section "10. PATIENT PAGES" (top bar) and "14. HEALTHCARE
   STAFF PAGES" in styles.css.
   ===================================================================== */

import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { getCurrentAccount, logOut, pageAfterLogin } from "../auth.js";
import { initials } from "../patientData.js";
import { isApproved } from "../staffData.js";

// Links in the top bar. "end" means "Home" is only active on /staff itself.
const STAFF_LINKS = [
  { to: "/staff", label: "Home", end: true, open: true },
  { to: "/staff/assessment", label: "New assessment" },
  { to: "/staff/reports", label: "Reports" },
  { to: "/staff/consultations", label: "Consultations" },
];

// Pages a staff member can open before the admin approves them.
const OPEN_BEFORE_APPROVAL = ["/staff", "/staff/profile"];

function StaffTopBar() {
  // undefined = still asking Flask, null = not signed in, object = the account
  const [account, setAccount] = useState(undefined);
  const { pathname } = useLocation();

  // Open every staff page at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    let isCurrent = true;
    getCurrentAccount().then((found) => {
      if (isCurrent) setAccount(found);
    });
    return () => {
      isCurrent = false;
    };
  }, []);

  if (account === undefined) return null; // still checking
  if (!account) return <Navigate to="/login" replace />;
  if (account.role !== "staff") return <Navigate to={pageAfterLogin(account)} replace />;

  const approved = isApproved(account);
  const pageIsOpen = approved || OPEN_BEFORE_APPROVAL.includes(pathname.replace(/\/$/, ""));

  return (
    <div className="site-shell patient-shell staff-shell">
      {/* ===== 1. Top bar ===== */}
      <header className="patient-header">
        <div className="patient-header-inner">
          <Link to="/staff" className="brand" aria-label="BurnCare staff home">
            <img className="brand-logo" src="/burncare-logo.png" alt="" width="36" height="38" />
            <span className="brand-name">BurnCare</span>
          </Link>

          <nav className="patient-nav" aria-label="Staff menu">
            {STAFF_LINKS.map((link) =>
              approved || link.open ? (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) => `patient-nav-link${isActive ? " is-active" : ""}`}
                >
                  {link.label}
                </NavLink>
              ) : (
                <span key={link.to} className="patient-nav-link is-disabled" title="Opens after the admin approves your account">
                  {link.label}
                </span>
              ),
            )}
          </nav>

          <AccountMenu account={account} />
        </div>
      </header>

      {/* ===== 2. The page ===== */}
      <main id="main-content" className="patient-main">
        {pageIsOpen ? <Outlet context={{ account, setAccount }} /> : <WaitingForApproval />}
      </main>

      {/* ===== 3. Disclaimer ===== */}
      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-fineprint">
            <p>
              BurnCare is a clinical decision-support tool. It does not diagnose burns, prescribe treatment, or
              decide whether surgery is required.
            </p>
            <p>Use test information only. Emergency ambulance in Saudi Arabia: 997.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Shown instead of a page that needs approval.
function WaitingForApproval() {
  return (
    <div className="patient-page">
      <section className="patient-card staff-waiting" role="status">
        <h2>Waiting for admin approval</h2>
        <p>
          The BurnCare team checks your SCFHS registration. New assessment, Reports and Consultations open as soon
          as your account is approved.
        </p>
        <Link to="/staff" className="button button-secondary">
          Back to Home
        </Link>
      </section>
    </div>
  );
}

// Profile picture + name, with a menu: My profile, Log out.
function AccountMenu({ account }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const onProfile = location.pathname.startsWith("/staff/profile");

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
          {initials(account.fullName)}
        </span>
        <span className="patient-name">{account.fullName}</span>
        <svg className="account-caret" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
          <path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="account-menu" id="account-menu" role="menu">
          <div className="account-menu-head">
            <span className="patient-avatar" aria-hidden="true">
              {initials(account.fullName)}
            </span>
            <div>
              <p className="account-menu-name">{account.fullName}</p>
              <p className="account-menu-email">{account.staffRole || account.email}</p>
            </div>
          </div>

          <Link to="/staff/profile" className="account-menu-item" role="menuitem">
            <PersonIcon />
            My profile
          </Link>
          <button
            type="button"
            className="account-menu-item account-menu-logout"
            role="menuitem"
            onClick={async () => {
              await logOut();
              navigate("/login", { replace: true });
            }}
          >
            <LogoutIcon />
            Log out
          </button>
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

export default StaffTopBar;