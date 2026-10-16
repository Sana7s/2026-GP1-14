/* =====================================================================
   BurnCare — pages/ComingSoonPage.jsx
   ---------------------------------------------------------------------
   The "Coming soon" page, used for Login (and any unknown address).
   ===================================================================== */

import { Link } from "react-router-dom";
import { Chevron } from "../components/Chevron.jsx";

/* =====================================================================
   9. "COMING SOON" PAGE
   Used for Login until it is built.
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

export default ComingSoonPage;
