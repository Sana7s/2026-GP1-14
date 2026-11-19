/* =====================================================================
   BurnCare — components/PageCrumb.jsx
   ---------------------------------------------------------------------
   The thin strip under the header that shows where you are, e.g.
       Patient › My reports › Report
   The earlier parts are links, so users can go back up; the last part
   is the page you're on. It also names the browser tab:
   "Report · BurnCare".
   Used under all four headers: Layout.jsx (public), PatientTopBar.jsx,
   StaffTopBar.jsx and AdminTopBar.jsx.
   Page names: pageNames.js. Styles: "Breadcrumb under the header" in
   styles.css.
   ===================================================================== */

import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { breadcrumbFor } from "../pageNames.js";

function PageCrumb() {
  const { pathname } = useLocation();
  const trail = breadcrumbFor(pathname);
  const pageName = trail[trail.length - 1].name;

  // The browser tab shows the page too.
  useEffect(() => {
    document.title = `${pageName} · BurnCare`;
  }, [pageName]);

  return (
    <nav className="page-crumb" aria-label="You are here">
      <ol className="page-crumb-inner">
        {trail.map((item, index) => {
          const isLast = index === trail.length - 1;
          return (
            <li key={`${item.name}-${index}`} className="page-crumb-item">
              {isLast ? (
                <span className="page-crumb-current" aria-current="page">
                  {item.name}
                </span>
              ) : (
                <>
                  <Link to={item.to} className="page-crumb-link">
                    {item.name}
                  </Link>
                  <span className="page-crumb-sep" aria-hidden="true">
                    <svg viewBox="0 0 12 12" width="10" height="10">
                      <path d="M4.5 2.5L8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default PageCrumb;