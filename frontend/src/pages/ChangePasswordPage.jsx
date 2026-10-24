/* =====================================================================
   BurnCare — pages/ChangePasswordPage.jsx
   ---------------------------------------------------------------------
   Change password (/patient/change-password), opened from the Profile
   page. Three boxes: current password, new password, new password again.
   Flask checks the current password and saves the new one
   (POST /api/auth/change-password), then emails the owner that the
   password was changed.
   Same field styles as the Log in and Register pages; the page layout
   uses the Profile page styles (section 10 in styles.css).
   ===================================================================== */

import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../auth.js";

const FIELDS = ["current", "password", "confirm"];

// Checks ONE box and returns a problem message, or "" if it is fine.
// Same password rule as the Register and Forgot password pages.
function checkField(key, values) {
  if (key === "current" && !values.current) return "Please enter your current password.";
  if (key === "password") {
    if (!values.password) return "Please create a new password.";
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(values.password)) {
      return "Use at least 8 characters, with at least one letter and one number.";
    }
    if (values.password === values.current) return "Choose a password that is different from your current one.";
  }
  if (key === "confirm") {
    if (!values.confirm) return "Please type your new password again.";
    if (values.confirm !== values.password) return "The two passwords don't match.";
  }
  return "";
}

// Which box a server error belongs to.
const SERVER_FIELD = { currentPassword: "current", newPassword: "password" };

function ChangePasswordPage() {
  const [values, setValues] = useState({ current: "", password: "", confirm: "" });
  const [problems, setProblems] = useState({});
  const [show, setShow] = useState(false); // show the passwords as text?
  const [saving, setSaving] = useState(false);
  const [serverMessage, setServerMessage] = useState("");
  const [done, setDone] = useState(false);

  const update = (key, value) => {
    const next = { ...values, [key]: value };
    setValues(next);
    setServerMessage("");
    // Re-check boxes that already show a problem, so it clears once fixed.
    const fixed = {};
    for (const field of FIELDS) if (problems[field]) fixed[field] = checkField(field, next);
    setProblems({ ...problems, ...fixed });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    const found = {};
    for (const key of FIELDS) {
      const message = checkField(key, values);
      if (message) found[key] = message;
    }
    setProblems(found);
    const first = FIELDS.find((key) => found[key]);
    if (first) {
      document.getElementById(`password-${first}`)?.focus();
      return;
    }

    setSaving(true);
    setServerMessage("");
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: { currentPassword: values.current, newPassword: values.password },
      });
      setValues({ current: "", password: "", confirm: "" });
      setDone(true);
    } catch (error) {
      // e.g. "Your current password is incorrect." → under that box.
      const box = SERVER_FIELD[error.field];
      if (box) {
        setProblems({ [box]: error.message });
        document.getElementById(`password-${box}`)?.focus();
      } else {
        setServerMessage(error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  // ----- After saving -----
  if (done) {
    return (
      <div className="profile-page">
        <section className="patient-card profile-card password-done" role="status">
          <span className="password-done-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="26" height="26">
              <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <h1>Password changed</h1>
          <p>Use your new password next time you sign in. We&apos;ve sent you an email to let you know.</p>
          <Link to="/patient/profile" className="button button-primary profile-save-button">
            Back to profile
          </Link>
        </section>
      </div>
    );
  }

  // ----- The form -----
  return (
    <div className="profile-page">
      <header className="password-header">
        <Link to="/patient/profile" className="password-back">
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
            <path d="M8 2L4 6l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Profile
        </Link>
        <h1>Change password</h1>
        <p>For your safety, enter your current password first.</p>
      </header>

      <form onSubmit={handleSubmit} noValidate>
        <section className="patient-card profile-card" aria-label="Change password">
          <div className="password-fields">
            <PasswordField
              id="current"
              label="Current password"
              autoComplete="current-password"
              value={values.current}
              show={show}
              onChange={update}
              problem={problems.current}
            />
            <PasswordField
              id="password"
              label="New password"
              autoComplete="new-password"
              hint="At least 8 characters, with a letter and a number."
              value={values.password}
              show={show}
              onChange={update}
              problem={problems.password}
            />
            <PasswordField
              id="confirm"
              label="New password again"
              autoComplete="new-password"
              value={values.confirm}
              show={show}
              onChange={update}
              problem={problems.confirm}
            />

            <label className="password-show">
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
              Show passwords
            </label>
          </div>
        </section>

        <div className="profile-save">
          {serverMessage && (
            <p className="field-error" role="alert">
              {serverMessage}
            </p>
          )}
          <button type="submit" className="button button-primary profile-save-button" disabled={saving}>
            {saving ? "Saving…" : "Change password"}
          </button>
        </div>
      </form>
    </div>
  );
}

// One password box with its label, hint and red message.
function PasswordField({ id, label, hint, value, show, onChange, problem, autoComplete }) {
  return (
    <div className={`field${problem ? " is-missing" : ""}`}>
      <label className="field-label" htmlFor={`password-${id}`}>
        {label}
      </label>
      <div className="text-input">
        <input
          id={`password-${id}`}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(id, e.target.value)}
          aria-invalid={Boolean(problem)}
          aria-describedby={problem ? `password-${id}-error` : hint ? `password-${id}-hint` : undefined}
        />
      </div>
      {problem ? (
        <p className="field-error" id={`password-${id}-error`}>
          {problem}
        </p>
      ) : (
        hint && (
          <p className="field-hint" id={`password-${id}-hint`}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export default ChangePasswordPage;