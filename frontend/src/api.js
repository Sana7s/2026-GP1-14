/* BurnCare — api.js
   One small helper that every page uses to talk to the Flask backend.
   Example:
     const data = await api("/api/auth/login", { method: "POST", body: { email, password } });
   - "body" is sent as JSON.
   - "form" is sent as FormData (used for the burn photo upload).
   - If Flask replies with an error, api() throws an Error whose
     .message is Flask's message and .field is the form field it is about. */

async function api(path, { method = "GET", body, form } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      // Send the login cookie with every request.
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : form,
    });
  } catch {
    // Flask is not running, or there is no internet connection.
    throw new Error("Cannot reach the BurnCare server. Please make sure the backend is running and try again.");
  }

  // Read the reply as JSON (an empty reply becomes {}).
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const problem = new Error(data.error || "Something went wrong. Please try again.");
    problem.field = data.field; // e.g. "email", so the page can point to that box
    problem.status = response.status; // e.g. 401 = not logged in, 403 = not allowed
    throw problem;
  }
  return data;
}

export { api };