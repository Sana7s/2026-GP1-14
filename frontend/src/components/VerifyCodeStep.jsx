/* BurnCare — components/VerifyCodeStep.jsx
   Admin sign-in, step 2: shown inside the Log in card after an admin's
   email and password are accepted. (Based on adminLogin.jsx.) */

import { useEffect, useState } from "react";
import CodeBoxes from "./CodeBoxes.jsx";
import { TEST_CODE, TEST_MODE, resendCode, verifyCode } from "../auth.js";

const CODE_LENGTH = 6;
const RESEND_WAIT = 30; // seconds before "Send a new code" works
const EMPTY_CODE = Array(CODE_LENGTH).fill("");

function VerifyCodeStep({ emailHint, onVerified, onBack }) {
  const [code, setCode] = useState(EMPTY_CODE);
  const [attempt, setAttempt] = useState(0); // goes up after a wrong code
  const [problem, setProblem] = useState("");
  const [notice, setNotice] = useState("");
  const [checking, setChecking] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_WAIT);

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const timer = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  const check = async (digits) => {
    const joined = digits.join("");
    if (joined.length < CODE_LENGTH) {
      setProblem(`Please enter all ${CODE_LENGTH} digits.`);
      return;
    }
    setChecking(true);
    setProblem("");
    try {
      const account = await verifyCode(joined);
      onVerified(account);
    } catch (error) {
      setProblem(error.message); // e.g. "The code is incorrect. 4 tries left."
      setCode(EMPTY_CODE);
      setAttempt((n) => n + 1);
    } finally {
      setChecking(false);
    }
  };

  const sendNewCode = async () => {
    setProblem("");
    try {
      await resendCode();
      setNotice("A new code was sent. The old code no longer works.");
      setSecondsLeft(RESEND_WAIT);
      setCode(EMPTY_CODE);
      setAttempt((n) => n + 1);
    } catch (error) {
      setProblem(error.message);
    }
  };

  return (
    <form
      className="verify-step"
      onSubmit={(event) => {
        event.preventDefault();
        check(code);
      }}
      noValidate
    >
      <span className="verify-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6l7-3Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M9 12l2.2 2.2L15.5 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>

      <header className="login-header verify-header">
        <h1>Check your email</h1>
        <p className="login-subtitle">
          For extra security, admin accounts need a code. We sent a 6-digit code to{" "}
          <strong className="forgot-email">{emailHint}</strong>. It works for 10 minutes.
        </p>
      </header>

      {TEST_MODE && (
        <p className="forgot-test-note">
          <span className="forgot-test-badge">Test mode</span>
          <span>
            Your code is <strong className="test-code">{TEST_CODE}</strong>.
          </span>
        </p>
      )}

      <CodeBoxes
        code={code}
        attempt={attempt}
        problem={problem}
        disabled={checking}
        onChange={(next) => {
          setCode(next);
          setProblem("");
          setNotice("");
          if (next.every(Boolean)) check(next); // all filled → check straight away
        }}
      />

      {problem && (
        <p className="field-error forgot-code-error" role="alert">
          {problem}
        </p>
      )}
      {notice && !problem && (
        <p className="verify-notice" role="status">
          {notice}
        </p>
      )}

      <button type="submit" className="button button-primary login-submit" disabled={checking}>
        {checking ? "Checking…" : "Verify and continue"}
      </button>

      <div className="verify-links">
        <button type="button" className="forgot-resend" onClick={sendNewCode} disabled={secondsLeft > 0}>
          {secondsLeft > 0 ? `Send a new code (${secondsLeft}s)` : "Send a new code"}
        </button>
        <button type="button" className="forgot-resend" onClick={onBack}>
          Use a different account
        </button>
      </div>
    </form>
  );
}

export default VerifyCodeStep;