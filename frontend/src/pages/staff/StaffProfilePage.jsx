/* =====================================================================
   BurnCare — pages/staff/StaffProfilePage.jsx
   ---------------------------------------------------------------------
   My profile for healthcare staff (/staff/profile). Read only: the
   details come from the signed-in BurnCare account. Staff sign up on the
   Register page and are approved by the admin, so there is no "create
   profile", "switch profile" or editable Staff ID.
   Styles: "14. HEALTHCARE STAFF PAGES" in styles.css.
   ===================================================================== */

import { Link, useOutletContext } from "react-router-dom";
import { initials } from "../../patientData.js";
import { APPROVAL, isApproved, isSpecialist } from "../../staffData.js";

function StaffProfilePage() {
  const { account } = useOutletContext(); // the signed-in staff member (StaffTopBar)
  const status = APPROVAL[account.staffStatus] ?? APPROVAL.pending;
  const approved = isApproved(account);

  const rows = [
    ["Full name", account.fullName],
    ["Professional role", account.staffRole],
    ["Email", account.email],
    ["SCFHS registration number", account.scfhsNumber],
    [
      "Consultations",
      isSpecialist(account) ? "You can answer questions from other staff" : "You can ask approved burn specialists",
    ],
  ];

  return (
    <div className="patient-page profile-page">
      <header className="profile-header">
        <span className="profile-avatar" aria-hidden="true">
          {initials(account.fullName)}
        </span>
        <div>
          <h1>My profile</h1>
          <p>
            {account.staffRole} · {account.email}
          </p>
        </div>
      </header>

      <section className="patient-card profile-card" aria-labelledby="details-title">
        <div className="staff-profile-title">
          <h2 id="details-title">Your details</h2>
          <span className={`staff-approval ${status.tone}`}>{status.label}</span>
        </div>
        <dl className="staff-profile-list">
          {rows.map(([label, value]) => (
            <div key={label} className="staff-profile-row">
              <dt>{label}</dt>
              <dd>{value || "—"}</dd>
            </div>
          ))}
        </dl>
        <p className="patient-note">
          These details come from your BurnCare account. To change them, contact the BurnCare admin.
        </p>
      </section>

      {!approved && (
        <section className="patient-card staff-waiting" role="status">
          <h2>{account.staffStatus === "changes_requested" ? "The admin asked for changes" : "Waiting for admin approval"}</h2>
          <p>
            {account.staffStatus === "changes_requested" && account.adminNote
              ? account.adminNote
              : "The BurnCare team checks your SCFHS registration. New assessment, Reports and Consultations open as soon as your account is approved."}
          </p>
        </section>
      )}

      <section className="patient-card profile-account" aria-label="Account">
        <Link to="/staff" className="profile-account-link">
          <span>Back to Home</span>
          <span aria-hidden="true">›</span>
        </Link>
      </section>
    </div>
  );
}

export default StaffProfilePage;