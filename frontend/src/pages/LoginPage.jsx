/* =====================================================================
   BurnCare — pages/LoginPage.jsx
   ---------------------------------------------------------------------
   The sign-in page (/login): ONE form for everyone (patients, staff
   and admins). There is no account-type switch: Flask looks up the
   email and replies with that account's role.
     - Email + password, with an eye icon to show the password
     - Friendly messages under each field instead of browser pop-ups
     - Admins: after the password, a 6-digit code is emailed and the
       "Check your email" step (VerifyCodeStep) appears in the same card
     - Then each account goes to its own page (pageAfterLogin in auth.js)
   Styles: section "9. LOG IN PAGE" in styles.css.
   ===================================================================== */

import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Chevron } from "../components/Chevron.jsx";
import VerifyCodeStep from "../components/VerifyCodeStep.jsx";
import { TEST_ADMIN_EMAIL, TEST_MODE, TEST_STAFF_EMAIL, logIn, pageAfterLogin } from "../auth.js";

// Small glowing embers that float up around the logo.
//   x = how far from the left (%), size = in px,
//   delay / time = when it starts and how long one rise takes (seconds).
const SPARKS = [
  { x: 18, size: 5, delay: 0, time: 3.4 },
  { x: 30, size: 3, delay: 1.2, time: 2.8 },
  { x: 42, size: 4, delay: 2.1, time: 3.8 },
  { x: 55, size: 6, delay: 0.6, time: 3.2 },
  { x: 66, size: 3, delay: 1.8, time: 2.6 },
  { x: 76, size: 5, delay: 2.7, time: 3.6 },
  { x: 86, size: 3, delay: 0.9, time: 3.0 },
  { x: 24, size: 4, delay: 3.0, time: 3.3 },
  { x: 60, size: 3, delay: 3.4, time: 2.9 },
];

// Tiny dots around the logo that softly blink, like the logo's network points.
const TWINKLES = [
  { x: 6, y: 30, delay: 0 },
  { x: 92, y: 22, delay: 0.8 },
  { x: 2, y: 66, delay: 1.6 },
  { x: 96, y: 60, delay: 0.4 },
  { x: 20, y: 4, delay: 1.2 },
  { x: 78, y: 2, delay: 2.0 },
];

// Checks ONE field and returns a problem message, or "" if it is fine.
function checkLoginField(key, values) {
  const value = String(values[key] ?? "").trim();

  if (key === "email") {
    if (!value) return "Please enter your email.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Enter a valid email, e.g. name@example.com.";
  }
  if (key === "password" && !values.password) return "Please enter your password.";
  return "";
}

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // If another page sent an email along (e.g. after resetting the
  // password), start with it already typed in.
  const [values, setValues] = useState({
    email: location.state?.email ?? "",
    password: "",
  });
  const [problems, setProblems] = useState({}); // problem message per field
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false); // waiting for Flask?
  const [serverMessage, setServerMessage] = useState(""); // message from the server
  const [verifyHint, setVerifyHint] = useState(""); // admin: show the code step for this email

  // Save what the visitor typed. If that field had a problem, check it
  // again so the red message disappears as soon as it's fixed.
  const update = (key, value) => {
    const next = { ...values, [key]: value };
    setValues(next);
    setServerMessage("");
    if (problems[key]) setProblems({ ...problems, [key]: checkLoginField(key, next) });
  };

  // Runs when "Log in" is pressed.
  const handleSubmit = async (event) => {
    event.preventDefault(); // stop the page from reloading

    // 1. Check the fields first.
    const found = {};
    ["email", "password"].forEach((key) => {
      const message = checkLoginField(key, values);
      if (message) found[key] = message;
    });
    setProblems(found);
    if (Object.keys(found).length > 0) {
      // Put the cursor in the first field with a problem.
      const firstKey = found.email ? "email" : "password";
      document.getElementById(`login-${firstKey}`)?.focus();
      return;
    }

    // 2. Send the details to Flask.
    setLoading(true);
    setServerMessage("");
    try {
      const result = await logIn(values.email, values.password);
      if (result.verificationRequired) {
        // Admin: a code was emailed → show the "Check your email" step.
        setVerifyHint(result.emailHint);
        return;
      }
      // Flask keeps the login in a cookie (credentials: same-origin).
      navigate(pageAfterLogin(result.account));
    } catch (error) {
      // Wrong email/password, not approved yet, or Flask is off.
      setServerMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="login-page">
      <div className="login-card">
        {/* ===== Coral panel with the logo (top on phones, left on computers) ===== */}
        <aside className="login-brand" aria-hidden="true">
          <div className="login-logo-wrap">
            {/* Embers floating up behind the logo */}
            {SPARKS.map((spark, index) => (
              <span
                key={`spark-${index}`}
                className="login-spark"
                style={{
                  "--x": `${spark.x}%`,
                  "--size": `${spark.size}px`,
                  "--delay": `${spark.delay}s`,
                  "--time": `${spark.time}s`,
                }}
              />
            ))}
            {/* Blinking dots around the logo */}
            {TWINKLES.map((dot, index) => (
              <span
                key={`dot-${index}`}
                className="login-twinkle"
                style={{ "--x": `${dot.x}%`, "--y": `${dot.y}%`, "--delay": `${dot.delay}s` }}
              />
            ))}
            <img className="login-logo" src="/burncare-logo.png" alt="" width="104" height="112" />
          </div>
          <p className="login-brand-name">BurnCare</p>
          <p className="login-brand-text">Fast, informed burn assessment for patients and care teams.</p>
        </aside>

        {/* ===== The form (or, for admins, the "Check your email" step) ===== */}
        <div className="login-body" key={verifyHint ? "verify" : "login"}>
          {verifyHint ? (
            <VerifyCodeStep
              emailHint={verifyHint}
              onVerified={(account) => navigate(pageAfterLogin(account))}
              onBack={() => {
                setVerifyHint("");
                setValues((current) => ({ ...current, password: "" }));
              }}
            />
          ) : (
            <>
              <header className="login-header">
                <h1>Sign in</h1>
                <p className="login-subtitle">Welcome back. Sign in to continue.</p>
              </header>

              {/* noValidate: we show our own friendly messages instead of the browser's. */}
              <form className="login-form" onSubmit={handleSubmit} noValidate>
                <LoginField
                  id="email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={values.email}
                  onChange={update}
                  problem={problems.email}
                />

                <LoginField
                  id="password"
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={values.password}
                  onChange={update}
                  problem={problems.password}
                  action={
                    <button
                      type="button"
                      className="input-action input-eye"
                      onClick={() => setShowPassword((shown) => !shown)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      <EyeIcon crossed={showPassword} />
                    </button>
                  }
                />

                <div className="login-forgot-row">
                  {/* Sends the email typed so far, so it doesn't need typing again. */}
                  <Link to="/forgot-password" state={{ email: values.email.trim() }} className="login-forgot">
                    Forgot password?
                  </Link>
                </div>

                {serverMessage && (
                  <p className="login-server-message" role="alert">
                    {serverMessage}
                  </p>
                )}

                <button type="submit" className="button button-primary login-submit" disabled={loading}>
                  {loading ? "Signing in…" : "Log in"}
                  {!loading && <Chevron />}
                </button>
              </form>

              {TEST_MODE && (
                <p className="forgot-test-note login-test-note">
                  <span className="forgot-test-badge">Test mode</span>
                  <span>
                    Any email signs in as a patient. Use <strong>{TEST_STAFF_EMAIL}</strong> for staff,{" "}
                    <strong>{TEST_ADMIN_EMAIL}</strong> for the admin, or the password <strong>wrong</strong> to see
                    the error.
                  </span>
                </p>
              )}

              <p className="login-signup">
                Don&apos;t have an account? <Link to="/register">Sign up</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

// One labelled text box (email, password). Uses the same classes as the
// Register page (.field, .field-label, .field-error) so both look the same.
//   action  → a button inside the box (e.g. the eye icon)
//   problem → the red message to show under it
function LoginField({ id, label, value, onChange, problem, action, ...inputProps }) {
  return (
    <div className={`field login-field${problem ? " is-missing" : ""}`}>
      <label className="field-label" htmlFor={`login-${id}`}>
        {label}
      </label>
      <div className={`text-input login-input${action ? " has-action" : ""}`}>
        <input
          id={`login-${id}`}
          value={value}
          onChange={(e) => onChange(id, e.target.value)}
          aria-invalid={Boolean(problem)}
          aria-describedby={problem ? `login-${id}-error` : undefined}
          {...inputProps}
        />
        {action}
      </div>
      {problem && (
        <p className="field-error" id={`login-${id}-error`}>
          {problem}
        </p>
      )}
    </div>
  );
}

// Eye icon for the password box: open eye = show, crossed eye = hide.
function EyeIcon({ crossed }) {
  const line = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path {...line} d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle {...line} cx="12" cy="12" r="3" />
      {crossed && <path {...line} d="M4 4l16 16" />}
    </svg>
  );
}

export default LoginPage;