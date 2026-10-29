/* =====================================================================
   BurnCare — components/AdminTopBar.jsx
   ---------------------------------------------------------------------
   The frame around the admin pages (/admin):
     1. Checks that an ADMIN is signed in. Anyone else is sent to /login.
     2. Top bar: logo · "Admin" badge · admin's name · Log out
     3. The page itself (<Outlet />, e.g. AdminPage)
   This check only hides the page in the browser. The real protection is
   in Flask: every /api/admin/... route must refuse non-admins.
   Styles: "Admin top bar" in section 10 of styles.css.
   ===================================================================== */

import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { getCurrentAccount, logOut } from "../auth.js";

function AdminTopBar() {
  const navigate = useNavigate();
  const [account, setAccount] = useState(null); // the signed-in admin
  const [checking, setChecking] = useState(true);

  // Who is signed in? Not an admin → back to the Log in page.
  useEffect(() => {
    let isCurrent = true;
    getCurrentAccount().then((current) => {
      if (!isCurrent) return;
      if (current?.role === "admin") {
        setAccount(current);
        setChecking(false);
      } else {
        navigate("/login", { replace: true });
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [navigate]);

  const handleLogOut = async () => {
    await logOut();
    navigate("/login", { replace: true });
  };

  if (checking) {
    return (
      <div className="admin-checking" role="status">
        Checking access…
      </div>
    );
  }

  return (
    <div className="site-shell patient-shell">
      <header className="patient-header">
        <div className="patient-header-inner admin-header-inner">
          <Link to="/admin" className="brand" aria-label="BurnCare admin home">
            <img className="brand-logo" src="/burncare-logo.png" alt="" width="36" height="38" />
            <span className="brand-name">BurnCare</span>
            <span className="admin-badge">Admin</span>
          </Link>

          <div className="admin-account">
            <span className="patient-name">{account.fullName}</span>
            <button type="button" className="admin-logout" onClick={handleLogOut}>
              Log out
            </button>
          </div>
        </div>
      </header>

      <main id="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminTopBar;