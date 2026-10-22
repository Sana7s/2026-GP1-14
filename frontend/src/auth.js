/* =====================================================================
   BurnCare — auth.js
   Everything to do with signing in, used by the Log in page, the admin
   code step and the Admin page. (Based on adminLogin.jsx.)
   Flask routes used:
     POST /api/auth/login        { email, password }
                                 → { user } or { verificationRequired, emailHint }
     POST /api/auth/verify-code  { code } → { user }
     POST /api/auth/resend-code
     POST /api/auth/logout
     GET  /api/auth/me           → { user }  (401 when not signed in)
   ===================================================================== */

/* TEST MODE — until Flask is running. Only on the dev server.
     • admin@burncare.test → admin: asks for the code 123456 → /admin
     • staff@burncare.test → healthcare staff → home page (for now)
     • any other email     → patient → /patient
     • password "wrong"    → "The email or password is incorrect."       */
const USE_TEST_MODE = true; // ← change to false once Flask is running
export const TEST_MODE = USE_TEST_MODE && import.meta.env.DEV;
export const TEST_ADMIN_EMAIL = "admin@burncare.test";
export const TEST_STAFF_EMAIL = "staff@burncare.test";
export const TEST_CODE = "123456";
const TEST_KEY = "burncare-test-account";

// Sends a request to Flask. If Flask replies with an error, it throws an
// Error whose .message can be shown on the page.
export async function api(path, { method = "GET", body } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      credentials: "same-origin", // send the login cookie
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Cannot reach the BurnCare server. Please make sure the backend is running.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Sign-in isn't connected to the server yet. Please try again later.");
    error.status = response.status;
    throw error;
  }
  return data;
}

// ---------- Test mode helpers ----------
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readTestAccount(key = TEST_KEY) {
  try {
    return JSON.parse(sessionStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function saveTestAccount(account, key = TEST_KEY) {
  try {
    if (account) sessionStorage.setItem(key, JSON.stringify(account));
    else sessionStorage.removeItem(key);
  } catch {
    // Storage blocked (e.g. private window): the test session won't persist.
  }
}

const hideEmail = (email) => email.replace(/^(.)[^@]*/, "$1***"); // "sara@x.com" → "s***@x.com"

// ---------- Sign-in steps ----------

// Step 1: email + password. Returns ONE of:
//   { verificationRequired: true, emailHint }  → admin: show the code step
//   { account: { id, fullName, email, role } } → signed in
export async function logIn(email, password) {
  const cleanEmail = email.trim();

  if (TEST_MODE) {
    await wait(600);
    if (password === "wrong") throw new Error("The email or password is incorrect.");
    if (cleanEmail.toLowerCase() === TEST_ADMIN_EMAIL) {
      saveTestAccount({ id: 1, fullName: "BurnCare Admin", email: cleanEmail, role: "admin" }, `${TEST_KEY}-pending`);
      return { verificationRequired: true, emailHint: hideEmail(cleanEmail) };
    }
    const role = cleanEmail.toLowerCase() === TEST_STAFF_EMAIL ? "staff" : "patient";
    const account = { id: 2, fullName: "Test User", email: cleanEmail, role };
    saveTestAccount(account);
    return { account };
  }

  const data = await api("/api/auth/login", { method: "POST", body: { email: cleanEmail, password } });
  if (data.verificationRequired) return { verificationRequired: true, emailHint: data.emailHint };
  return { account: data.user };
}

// Step 2 (admins only): the 6-digit code from the email. Returns the account.
export async function verifyCode(code) {
  if (TEST_MODE) {
    await wait(600);
    if (code !== TEST_CODE) throw new Error("The code is incorrect. Please try again.");
    const account = readTestAccount(`${TEST_KEY}-pending`);
    saveTestAccount(null, `${TEST_KEY}-pending`);
    saveTestAccount(account);
    return account;
  }
  const data = await api("/api/auth/verify-code", { method: "POST", body: { code } });
  return data.user;
}

// Sends a new code (the old one stops working).
export async function resendCode() {
  if (TEST_MODE) {
    await wait(400);
    return;
  }
  await api("/api/auth/resend-code", { method: "POST" });
}

// Who is signed in right now, or null.
export async function getCurrentAccount() {
  if (TEST_MODE) return readTestAccount();
  try {
    const data = await api("/api/auth/me");
    return data.user ?? null;
  } catch {
    return null; // not signed in (401), or the server is off
  }
}

// Where each account goes after signing in.
export function pageAfterLogin(account) {
  if (account.role === "admin") return "/admin";
  if (account.role === "patient") return "/patient";
  return "/"; // TODO: change to the staff page address when it's ready
}

// Sign out.
export async function logOut() {
  if (TEST_MODE) {
    saveTestAccount(null);
    return;
  }
  await api("/api/auth/logout", { method: "POST" }).catch(() => {});
}