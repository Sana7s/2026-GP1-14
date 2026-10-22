/* =====================================================================
   BurnCare — pages/ForgotPasswordPage.jsx
   ---------------------------------------------------------------------
   The "Forgot password" page (/forgot-password), in three steps:
     1. Email         → Flask emails a 6-digit code
     2. Verify code   → six boxes; Flask checks the code
     3. New password  → Flask saves it
   Then a "Password updated" screen.

   Flask routes this page talks to:
     POST /api/auth/forgot-password    { email }
     POST /api/auth/verify-reset-code  { email, code }   → { reset_token }
     POST /api/auth/reset-password     { reset_token, password }

   Uses the Register page layout and styles (.register-page, stepper,
   .field, .text-input, slide animation) so both pages match.
   Extra styles: "Forgot password" part of section 9 in styles.css.
   ===================================================================== */

import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Chevron } from "../components/Chevron.jsx";
import { prefersReducedMotion } from "../components/animations.jsx";
import CodeBoxes from "../components/CodeBoxes.jsx";

/* ---------------------------------------------------------------------
   TEST MODE — until Flask can send real emails.
   While true, nothing is sent to Flask: the page uses fake replies
   (testServer below) so the whole flow can be tried and demonstrated.
     • Any valid email "receives" a code
     • The correct code is TEST_CODE (shown on screen in test mode)
     • Any other code shows the "incorrect or expired" message
     • Email "offline@test.com" pretends the server is off
   It only works on the local dev server (npm run dev), never in the
   built website. TODO: set to false once the Flask routes are ready.
   --------------------------------------------------------------------- */
const USE_TEST_MODE = true; // ← change to false once Flask can send emails
const TEST_MODE = USE_TEST_MODE && import.meta.env.DEV;
const TEST_CODE = "123456";

const CODE_LENGTH = 6; // digits in the code
const RESEND_WAIT = 30; // seconds before "Resend code" can be pressed again
const STEPS = ["Email", "Verify code", "New password"];

// Message shown when Flask is off or the route isn't written yet.
const NOT_CONNECTED = "Password reset isn't connected to the server yet. Please try again later.";

// ---------- Checks: return a problem message, or "" if fine ----------
function checkEmail(value) {
  const email = value.trim();
  if (!email) return "Please enter your email.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email, e.g. name@example.com.";
  return "";
}

// Same password rule as the Register page.
function checkPassword(value) {
  if (!value) return "Please create a new password.";
  if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(value)) {
    return "Use at least 8 characters, with at least one letter and one number.";
  }
  return "";
}

function checkConfirm(password, confirm) {
  if (!confirm) return "Please type your new password again.";
  if (confirm !== password) return "The two passwords don't match.";
  return "";
}

// Fake Flask replies for TEST MODE. Same shape as postJSON's result.
async function testServer(url, body) {
  await new Promise((resolve) => setTimeout(resolve, 700)); // feel like a real request

  if (body.email === "offline@test.com") throw new Error("Pretend the server is off");

  if (url.endsWith("/forgot-password")) {
    console.info(`[Test mode] Reset code for ${body.email}: ${TEST_CODE}`);
    return { ok: true, status: 200, data: {} };
  }
  if (url.endsWith("/verify-reset-code")) {
    return body.code === TEST_CODE
      ? { ok: true, status: 200, data: { reset_token: "test-reset-token" } }
      : { ok: false, status: 401, data: {} };
  }
  if (url.endsWith("/reset-password")) {
    return body.reset_token === "test-reset-token"
      ? { ok: true, status: 200, data: {} }
      : { ok: false, status: 401, data: {} };
  }
  return { ok: false, status: 404, data: {} };
}

// Sends JSON to a Flask route and returns { ok, status, data }.
// Throws if Flask can't be reached at all.
async function postJSON(url, body) {
  if (TEST_MODE) return testServer(url, body);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data = {};
  try {
    data = await response.json();
  } catch {
    // The reply wasn't JSON (e.g. the route doesn't exist yet).
  }
  return { ok: response.ok, status: response.status, data };
}

function ForgotPasswordPage() {
  const [step, setStep] = useState(1); // 1 email, 2 code, 3 new password
  const [direction, setDirection] = useState("forward"); // slide direction
  const [finished, setFinished] = useState(false); // show "Password updated"?

  // The Log in page sends along the email typed there, if any.
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email ?? "");
  const [code, setCode] = useState(Array(CODE_LENGTH).fill("")); // one digit per box
  const [codeAttempt, setCodeAttempt] = useState(0); // goes up after a wrong code
  const [resetToken, setResetToken] = useState(""); // from Flask after the code is accepted
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [problems, setProblems] = useState({}); // red message per field
  const [serverMessage, setServerMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0); // countdown for "Resend code"

  const topRef = useRef(null);

  // Count down one second at a time until "Resend code" is allowed.
  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  // Move to another step with the slide animation.
  const goToStep = (number) => {
    setDirection(number > step ? "forward" : "back");
    setStep(number);
    setProblems({});
    setServerMessage("");
    topRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  };

  // ---------- Step 1: send the code ----------
  const sendCode = async () => {
    setLoading(true);
    setServerMessage("");
    try {
      const result = await postJSON("/api/auth/forgot-password", { email: email.trim() });
      if (!result.ok) throw new Error();
      setSecondsLeft(RESEND_WAIT);
      setCode(Array(CODE_LENGTH).fill(""));
      return true;
    } catch {
      setServerMessage(NOT_CONNECTED);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (event) => {
    event.preventDefault();
    const message = checkEmail(email);
    setProblems({ email: message });
    if (message) {
      document.getElementById("forgot-email")?.focus();
      return;
    }
    if (await sendCode()) goToStep(2);
  };

  // ---------- Step 2: check the code ----------
  const verifyCode = async (digits = code) => {
    const joined = digits.join("");
    if (joined.length < CODE_LENGTH) {
      setProblems({ code: `Please enter all ${CODE_LENGTH} digits.` });
      return;
    }
    setLoading(true);
    setServerMessage("");
    try {
      const result = await postJSON("/api/auth/verify-reset-code", { email: email.trim(), code: joined });
      if (result.status === 400 || result.status === 401) {
        setProblems({ code: "That code is incorrect or has expired." });
        // Empty the boxes so the next code can be typed from the start.
        setCode(Array(CODE_LENGTH).fill(""));
        setCodeAttempt((n) => n + 1);
        return;
      }
      if (!result.ok) throw new Error();
      setResetToken(result.data.reset_token ?? "");
      goToStep(3);
    } catch {
      setServerMessage(NOT_CONNECTED);
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = (event) => {
    event.preventDefault();
    verifyCode();
  };

  // ---------- Step 3: save the new password ----------
  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    const found = { password: checkPassword(password), confirm: checkConfirm(password, confirm) };
    setProblems(found);
    if (found.password || found.confirm) {
      document.getElementById(found.password ? "reset-password" : "reset-confirm")?.focus();
      return;
    }

    setLoading(true);
    setServerMessage("");
    try {
      const result = await postJSON("/api/auth/reset-password", { reset_token: resetToken, password });
      if (result.status === 400 || result.status === 401) {
        setServerMessage("This reset session has expired. Please request a new code.");
        return;
      }
      if (!result.ok) throw new Error();
      setFinished(true);
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    } catch {
      setServerMessage(NOT_CONNECTED);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Done screen ----------
  if (finished) {
    return (
      <section className="register-page">
        <div className="register-done forgot-done">
          <span className="guest-done-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28">
              <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <h1>Password updated</h1>
          <p className="register-done-text">You can now log in with your new password.</p>
          <div className="hero-actions">
            {/* Sends the email back so the Log in page has it filled in. */}
            <Link className="button button-primary" to="/login" state={{ email: email.trim() }}>
              Go to log in <Chevron />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="register-page">
      <div className="register-container" ref={topRef}>
        <header className="register-header">
          <h1>Reset your password</h1>
          <p className="register-subtitle">It only takes a minute.</p>
        </header>

        {/* ===== Three-step progress bar (same as Register) ===== */}
        <div className="register-stepper" aria-label={`Step ${step} of ${STEPS.length}`}>
          {STEPS.map((label, index) => {
            const number = index + 1;
            const state = number < step ? "is-done" : number === step ? "is-current" : "";
            return (
              <div key={label} className={`stepper-item ${state}`}>
                <span className="stepper-dot">{number < step ? "✓" : number}</span>
                <span className="stepper-label">{label}</span>
              </div>
            );
          })}
          <span className="stepper-track" aria-hidden="true">
            <span className="stepper-fill" style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }} />
          </span>
        </div>

        {/* "key" rebuilds this box when the step changes, which plays the slide. */}
        <div key={step} className={`register-panel slide-${direction}`}>
          {step === 1 && (
            /* ===== Step 1: email ===== */
            <form onSubmit={handleEmailSubmit} noValidate>
              <p className="forgot-intro">
                Enter the email you registered with and we&apos;ll send you a {CODE_LENGTH}-digit code.
              </p>
              {TEST_MODE && (
                <TestNote>
                  No real email is sent yet. Use any email to continue, or <strong>offline@test.com</strong> to
                  see the &ldquo;server is off&rdquo; message.
                </TestNote>
              )}
              <div className="register-fields">
                <TextBox
                  id="forgot-email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={email}
                  problem={problems.email}
                  onChange={(value) => {
                    setEmail(value);
                    setServerMessage("");
                    if (problems.email) setProblems({ email: checkEmail(value) });
                  }}
                />
              </div>

              <ServerMessage text={serverMessage} />

              <div className="register-submit">
                <button type="submit" className="button button-primary register-button" disabled={loading}>
                  {loading ? "Sending…" : "Send code"}
                  {!loading && <Chevron />}
                </button>
                <p>
                  Remembered it?{" "}
                  <Link to="/login" state={{ email: email.trim() }}>
                    Log in
                  </Link>
                </p>
              </div>
            </form>
          )}

          {step === 2 && (
            /* ===== Step 2: enter the code ===== */
            <form onSubmit={handleCodeSubmit} noValidate>
              <div className="register-part-head">
                <h2 className="register-part-title">Enter your code</h2>
                <button type="button" className="back-button" onClick={() => goToStep(1)}>
                  <BackArrow />
                  Back
                </button>
              </div>

              {/* For safety, we never say whether an account exists for this email. */}
              <p className="forgot-intro">
                If an account exists for <strong className="forgot-email">{email.trim()}</strong>, we&apos;ve sent
                a {CODE_LENGTH}-digit code. It expires in 10 minutes.
              </p>
              {TEST_MODE && (
                <TestNote>
                  Your code is <strong className="test-code">{TEST_CODE}</strong>. Type anything else to see the
                  &ldquo;incorrect code&rdquo; message.
                </TestNote>
              )}

              <CodeBoxes
                code={code}
                attempt={codeAttempt}
                problem={problems.code}
                disabled={loading}
                onChange={(next) => {
                  setCode(next);
                  setServerMessage("");
                  if (problems.code) setProblems({});
                  // All boxes filled → check the code straight away.
                  if (next.every(Boolean)) verifyCode(next);
                }}
              />
              {problems.code && (
                <p className="field-error forgot-code-error" role="alert">
                  {problems.code}
                </p>
              )}

              <ServerMessage text={serverMessage} />

              <div className="register-submit">
                <button type="submit" className="button button-primary register-button" disabled={loading}>
                  {loading ? "Checking…" : "Verify code"}
                  {!loading && <Chevron />}
                </button>
                <p>
                  Didn&apos;t get it? Check your spam folder or{" "}
                  <button
                    type="button"
                    className="forgot-resend"
                    onClick={sendCode}
                    disabled={loading || secondsLeft > 0}
                  >
                    {secondsLeft > 0 ? `resend in ${secondsLeft}s` : "resend code"}
                  </button>
                </p>
              </div>
            </form>
          )}

          {step === 3 && (
            /* ===== Step 3: new password ===== */
            <form onSubmit={handlePasswordSubmit} noValidate>
              <h2 className="register-part-title">Create a new password</h2>
              <div className="register-fields">
                <TextBox
                  id="reset-password"
                  label="New password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  problem={problems.password}
                  hint="Use at least 8 characters, with a letter and a number."
                  onChange={(value) => {
                    setPassword(value);
                    setServerMessage("");
                    if (problems.password || problems.confirm) {
                      setProblems({
                        password: problems.password ? checkPassword(value) : "",
                        confirm: problems.confirm ? checkConfirm(value, confirm) : "",
                      });
                    }
                  }}
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
                <TextBox
                  id="reset-confirm"
                  label="Confirm new password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Type your new password again"
                  value={confirm}
                  problem={problems.confirm}
                  onChange={(value) => {
                    setConfirm(value);
                    if (problems.confirm) setProblems({ ...problems, confirm: checkConfirm(password, value) });
                  }}
                />
              </div>

              <ServerMessage text={serverMessage} />

              <div className="register-submit">
                <button type="submit" className="button button-primary register-button" disabled={loading}>
                  {loading ? "Saving…" : "Save new password"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------- Small pieces ----------

// One labelled text box, styled like the Register page fields.
function TextBox({ id, label, value, onChange, problem, hint, action, ...inputProps }) {
  return (
    <div className={`field${problem ? " is-missing is-flashing" : ""}`}>
      <label className="field-label" htmlFor={id}>
        {label} <span className="required-mark" aria-hidden="true">*</span>
      </label>
      <div className={`text-input${action ? " has-action" : ""}`}>
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(problem)}
          aria-describedby={problem ? `${id}-error` : hint ? `${id}-hint` : undefined}
          {...inputProps}
        />
        {action}
      </div>
      {problem ? (
        <p className="field-error" id={`${id}-error`}>
          {problem}
        </p>
      ) : (
        hint && (
          <p className="field-hint" id={`${id}-hint`}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

// Dashed box shown only in TEST MODE, explaining what to type.
function TestNote({ children }) {
  return (
    <p className="forgot-test-note">
      <span className="forgot-test-badge">Test mode</span>
      <span>{children}</span>
    </p>
  );
}

function ServerMessage({ text }) {
  if (!text) return null;
  return (
    <p className="forgot-server-message" role="alert">
      {text}
    </p>
  );
}

function BackArrow() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
      <path d="M8 2L4 6l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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

export default ForgotPasswordPage;