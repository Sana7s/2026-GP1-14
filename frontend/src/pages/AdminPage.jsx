/* =====================================================================
   BurnCare — pages/AdminPage.jsx
   ---------------------------------------------------------------------
   The Admin page (address: /admin).
   Only the admin can open it. Here the admin:
     1. Reviews registration requests from healthcare staff and approves
        or rejects them (staff cannot use BurnCare until approved).
     2. Manages approved staff (search, suspend or reactivate access).
     3. Sees a log of every decision (who did what, and when).
   For each request the admin can Approve, Request changes (to the
   SCFHS number, name or role they entered), or Reject with a reason.

   NOTE: the data below is SAMPLE data so the page can be seen and tested.
   TODO (backend): load the requests, staff and log from the Flask API,
   send each decision to Flask, and make sure only admins can open /admin.
   ===================================================================== */

import { useMemo, useState } from "react";

/* =====================================================================
   SAMPLE DATA — replace with data from the Flask API later
   ===================================================================== */

// Staff who registered and are waiting for the admin.
// "hoursWaiting" = how long ago they sent the request.
const SAMPLE_REQUESTS = [
  { id: "r1", name: "Dr. Khalid Al-Harbi", role: "Burn specialist", scfhs: "14RM0045821", phone: "+966 55 123 4567", email: "k.alharbi@example.com", hoursWaiting: 3 },
  { id: "r2", name: "Noura Al-Qahtani", role: "Nurse", scfhs: "19RN0023317", phone: "+966 50 876 5432", email: "noura.q@example.com", hoursWaiting: 52 },
  { id: "r3", name: "Faisal Al-Mutairi", role: "EMS staff (paramedic)", scfhs: "21RE0009934", phone: "+966 54 222 3344", email: "faisal.m@example.com", hoursWaiting: 20 },
  { id: "r4", name: "Dr. Huda Al-Shehri", role: "Doctor", scfhs: "16RM0031207", phone: "+966 56 111 9080", email: "huda.s@example.com", hoursWaiting: 6 },
  { id: "r5", name: "Omar Hassan", role: "Doctor", scfhs: "16RM0031207", phone: "+971 50 765 4321", email: "omar.h@example.com", hoursWaiting: 2 },
  { id: "r6", name: "Maha Al-Dosari", role: "Other: Pharmacist", scfhs: "18RP0017745", phone: "+966 53 909 1212", email: "maha.d@example.com", hoursWaiting: 30 },
];

// Staff who are already approved.
const SAMPLE_STAFF = [
  { id: "s1", name: "Dr. Reem Al-Otaibi", role: "Burn specialist", scfhs: "11RM0012093", status: "Active", approved: "12 Oct 2026" },
  { id: "s2", name: "Dr. Saad Al-Ghamdi", role: "Doctor", scfhs: "15RM0028810", status: "Active", approved: "14 Oct 2026" },
  { id: "s3", name: "Lama Al-Zahrani", role: "Nurse", scfhs: "20RN0040021", status: "Active", approved: "15 Oct 2026" },
  { id: "s4", name: "Turki Al-Shammari", role: "EMS staff (paramedic)", scfhs: "22RE0003310", status: "Suspended", approved: "9 Oct 2026" },
];

// Earlier decisions (newest first).
const SAMPLE_LOG = [
  { id: "l1", text: "Approved Lama Al-Zahrani (Nurse)", when: "15 Oct 2026, 10:24", type: "approve" },
  { id: "l2", text: "Rejected Ali Saleh (Doctor) — SCFHS number not found", when: "14 Oct 2026, 16:02", type: "reject" },
  { id: "l3", text: "Suspended Turki Al-Shammari — licence expired", when: "13 Oct 2026, 09:15", type: "suspend" },
];

/* =====================================================================
   SETTINGS
   ===================================================================== */

const BURN_SPECIALIST = "Burn specialist";

// A request waiting longer than this is marked "Overdue".
const OVERDUE_HOURS = 48;

// If fewer burn specialists than this are active, show a warning:
// consultation requests may wait too long.
const MIN_SPECIALISTS = 2;

// What the admin must check before "Approve" can be pressed.
const CHECKS = [
  { key: "found", label: "SCFHS number found and active" },
  { key: "name", label: "Name matches the SCFHS record" },
  { key: "role", label: "Job title matches the chosen role" },
];
// One extra check for burn specialists (they answer consultations).
const SPECIALIST_CHECK = { key: "specialty", label: "Specialty is burn or plastic surgery" };

// What the admin can ask the person to correct. These are ONLY things
// already on the registration form, so the person can fix them by
// editing their request (no new questions or file uploads).
//   label   → shown on the button the admin picks
//   message → the instruction the person receives
const CORRECTIONS = [
  { key: "scfhs", label: "SCFHS number", message: "Please check your SCFHS number and enter it exactly as shown on your SCFHS card." },
  { key: "name", label: "Full name", message: "Please enter your full name exactly as it appears on your SCFHS card." },
  { key: "role", label: "Role", message: "Please confirm your role (Doctor, Nurse, EMS staff, Burn specialist or Other)." },
];

// Reasons the admin can pick when rejecting a request.
const REJECT_REASONS = [
  "SCFHS number not found",
  "Name does not match",
  "Role does not match",
  "Duplicate account",
  "Other",
];

// The role filter buttons.
const ROLE_FILTERS = ["All", BURN_SPECIALIST, "Doctor", "Nurse", "EMS staff", "Other"];

/* =====================================================================
   SMALL HELPERS
   ===================================================================== */

// "Dr. Khalid Al-Harbi" → "KA" (titles like "Dr." are skipped).
function initials(name) {
  return name
    .split(/\s+/)
    .filter((part) => !/^dr\.?$/i.test(part))
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

// 3 → "3 hours ago", 52 → "2 days ago".
function waitingText(hours) {
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// Does this role match the chosen filter button?
function matchesFilter(role, filter) {
  if (filter === "All") return true;
  if (filter === "Other") return role.startsWith("Other");
  return role.startsWith(filter);
}

// The current date and time, written like "21 Oct 2026, 13:40".
function nowText() {
  const now = new Date();
  const date = now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

/* =====================================================================
   ADMIN PAGE
   ===================================================================== */
function AdminPage() {
  const [requests, setRequests] = useState(SAMPLE_REQUESTS); // waiting for a decision
  const [staff, setStaff] = useState(SAMPLE_STAFF); // approved staff
  const [log, setLog] = useState(SAMPLE_LOG); // activity log
  const [tab, setTab] = useState("requests"); // "requests", "staff" or "log"
  const [filter, setFilter] = useState("All"); // role filter for the requests
  const [selectedId, setSelectedId] = useState(null); // request being reviewed
  const [checks, setChecks] = useState({}); // ticked checks per request
  const [toast, setToast] = useState(""); // short message after a decision

  // Sort the requests: burn specialists first (they unlock consultations),
  // then the ones that have waited the longest.
  const sortedRequests = useMemo(
    () =>
      [...requests]
        .filter((request) => matchesFilter(request.role, filter))
        .sort((a, b) => {
          const aSpecialist = a.role === BURN_SPECIALIST ? 1 : 0;
          const bSpecialist = b.role === BURN_SPECIALIST ? 1 : 0;
          if (aSpecialist !== bSpecialist) return bSpecialist - aSpecialist;
          return b.hoursWaiting - a.hoursWaiting;
        }),
    [requests, filter]
  );

  // The request open in the review panel (the first one if none is chosen).
  const selected = sortedRequests.find((r) => r.id === selectedId) || sortedRequests[0] || null;

  // Two requests with the same SCFHS number may be the same person
  // registering twice (or someone using another person's number).
  const duplicateNumbers = useMemo(() => {
    const seen = {};
    [...requests, ...staff].forEach((person) => {
      seen[person.scfhs] = (seen[person.scfhs] || 0) + 1;
    });
    return Object.keys(seen).filter((number) => seen[number] > 1);
  }, [requests, staff]);

  // Numbers for the four summary tiles at the top.
  const overdueCount = requests.filter((r) => r.hoursWaiting >= OVERDUE_HOURS).length;
  const activeSpecialists = staff.filter((s) => s.role === BURN_SPECIALIST && s.status === "Active").length;
  const activeStaff = staff.filter((s) => s.status === "Active").length;

  // Show a short message for a few seconds.
  const showToast = (message) => {
    setToast(message);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(""), 3500);
  };

  // Open a request in the review panel. On phones and tablets the panel
  // sits under the list, so we also scroll down to it.
  const openRequest = (id) => {
    setSelectedId(id);
    if (window.innerWidth <= 900) {
      window.requestAnimationFrame(() =>
        document.querySelector(".admin-panel")?.scrollIntoView({ behavior: "smooth", block: "start" })
      );
    }
  };

  // Add a line to the top of the activity log.
  const addLog = (text, type) => {
    setLog((current) => [{ id: `l${Date.now()}`, text, when: nowText(), type }, ...current]);
  };

  // Remove a request from the list once a decision is made.
  const removeRequest = (id) => {
    setRequests((current) => current.filter((r) => r.id !== id));
    setSelectedId(null);
  };

  // APPROVE: the person becomes active staff and can log in.
  // TODO (backend): send the approval to Flask and email the person.
  const approve = (request) => {
    setStaff((current) => [
      { id: `s${Date.now()}`, name: request.name, role: request.role, scfhs: request.scfhs, status: "Active", approved: nowText().split(",")[0] },
      ...current,
    ]);
    addLog(`Approved ${request.name} (${request.role})`, "approve");
    removeRequest(request.id);
    showToast(`${request.name} was approved and can now log in.`);
  };

  // REJECT: the request is closed with a reason the person will see.
  const reject = (request, reason, note) => {
    const why = reason === "Other" && note ? note : reason;
    addLog(`Rejected ${request.name} (${request.role}) — ${why}`, "reject");
    removeRequest(request.id);
    showToast(`${request.name}'s request was rejected.`);
  };

  // REQUEST CHANGES: the request stays in the list, marked with the
  // fields the person must fix (e.g. "SCFHS number"). The person logs in,
  // sees the instructions, corrects those fields and sends the request again.
  // TODO (backend): save the chosen fields and the note, and email the person.
  const askForCorrection = (request, fields, note) => {
    const labels = fields.map((key) => CORRECTIONS.find((item) => item.key === key).label);
    setRequests((current) =>
      current.map((r) => (r.id === request.id ? { ...r, corrections: labels, correctionNote: note } : r))
    );
    addLog(`Requested changes from ${request.name}: ${labels.join(", ")}`, "info");
    showToast(`Changes requested from ${request.name}: ${labels.join(", ")}.`);
  };

  // SUSPEND / REACTIVATE an approved staff member.
  const toggleSuspend = (person) => {
    const nextStatus = person.status === "Active" ? "Suspended" : "Active";
    setStaff((current) => current.map((s) => (s.id === person.id ? { ...s, status: nextStatus } : s)));
    addLog(`${nextStatus === "Active" ? "Reactivated" : "Suspended"} ${person.name}`, nextStatus === "Active" ? "approve" : "suspend");
    showToast(`${person.name} is now ${nextStatus.toLowerCase()}.`);
  };

  return (
    <section className="admin-page">
      <div className="admin-container">
        {/* ---------- TITLE ---------- */}
        <header className="admin-header">
          <div>
            <p className="admin-kicker">Admin</p>
            <h1>Staff access</h1>
            <p className="admin-subtitle">
              Review healthcare staff before they can use BurnCare.
            </p>
          </div>
        </header>

        {/* ---------- SUMMARY TILES ---------- */}
        <div className="admin-stats">
          <StatTile label="Waiting for review" value={requests.length} />
          <StatTile label={`Waiting over ${OVERDUE_HOURS} hours`} value={overdueCount} warn={overdueCount > 0} />
          <StatTile label="Active burn specialists" value={activeSpecialists} warn={activeSpecialists < MIN_SPECIALISTS} />
          <StatTile label="Active staff" value={activeStaff} />
        </div>

        {/* ---------- WARNING: too few burn specialists ---------- */}
        {activeSpecialists < MIN_SPECIALISTS && (
          <p className="admin-notice">
            <strong>Only {activeSpecialists} burn specialist{activeSpecialists === 1 ? " is" : "s are"} active.</strong>{" "}
            Consultation requests may wait longer. Burn specialist requests are shown first.
          </p>
        )}

        {/* ---------- TABS ---------- */}
        <div className="admin-tabs" role="tablist">
          <TabButton id="requests" current={tab} onSelect={setTab}>
            Requests <span className="admin-count">{requests.length}</span>
          </TabButton>
          <TabButton id="staff" current={tab} onSelect={setTab}>
            Staff <span className="admin-count">{staff.length}</span>
          </TabButton>
          <TabButton id="log" current={tab} onSelect={setTab}>
            Activity log
          </TabButton>
        </div>

        {/* ---------- TAB 1: REQUESTS ---------- */}
        {tab === "requests" && (
          <>
            <FilterChips value={filter} onChange={(value) => { setFilter(value); setSelectedId(null); }} />

            {sortedRequests.length === 0 ? (
              <div className="admin-empty">
                <p>No requests waiting{filter !== "All" ? " for this role" : ""}. You are all caught up.</p>
              </div>
            ) : (
              <div className="admin-review">
                {/* Left: the list of requests */}
                <ul className="admin-list">
                  {sortedRequests.map((request) => (
                    <li key={request.id}>
                      <button
                        type="button"
                        className={`admin-request${selected?.id === request.id ? " is-selected" : ""}`}
                        onClick={() => openRequest(request.id)}
                      >
                        <span className={`admin-avatar${request.role === BURN_SPECIALIST ? " is-specialist" : ""}`} aria-hidden="true">
                          {initials(request.name)}
                        </span>
                        <span className="admin-request-main">
                          <span className="admin-request-name">{request.name}</span>
                          <span className="admin-request-role">{request.role}</span>
                        </span>
                        <span className="admin-request-side">
                          <span className="admin-request-time">{waitingText(request.hoursWaiting)}</span>
                          <RequestFlags request={request} duplicates={duplicateNumbers} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>

                {/* Right: the review panel for the chosen request */}
                {selected && (
                  <ReviewPanel
                    key={selected.id}
                    request={selected}
                    isDuplicate={duplicateNumbers.includes(selected.scfhs)}
                    ticked={checks[selected.id] || {}}
                    onTick={(key, value) =>
                      setChecks((current) => ({ ...current, [selected.id]: { ...current[selected.id], [key]: value } }))
                    }
                    onApprove={() => approve(selected)}
                    onReject={(reason, note) => reject(selected, reason, note)}
                    onAskCorrection={(fields, note) => askForCorrection(selected, fields, note)}
                  />
                )}
              </div>
            )}
          </>
        )}

        {/* ---------- TAB 2: STAFF ---------- */}
        {tab === "staff" && <StaffTable staff={staff} onToggle={toggleSuspend} />}

        {/* ---------- TAB 3: ACTIVITY LOG ---------- */}
        {tab === "log" && (
          <ol className="admin-log">
            {log.map((entry) => (
              <li key={entry.id} className={`admin-log-item is-${entry.type}`}>
                <span className="admin-log-dot" aria-hidden="true" />
                <div>
                  <p>{entry.text}</p>
                  <time>{entry.when}</time>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* ---------- Short message after a decision ---------- */}
      {toast && (
        <div className="admin-toast" role="status">
          {toast}
        </div>
      )}
    </section>
  );
}

/* =====================================================================
   PIECES USED BY THE ADMIN PAGE
   ===================================================================== */

// One summary tile (a big number with a label). "warn" makes it coral.
function StatTile({ label, value, warn }) {
  return (
    <div className={`admin-stat${warn ? " is-warn" : ""}`}>
      <span className="admin-stat-value">{value}</span>
      <span className="admin-stat-label">{label}</span>
    </div>
  );
}

// One tab button.
function TabButton({ id, current, onSelect, children }) {
  const active = current === id;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`admin-tab${active ? " is-active" : ""}`}
      onClick={() => onSelect(id)}
    >
      {children}
    </button>
  );
}

// The row of role filter buttons.
function FilterChips({ value, onChange }) {
  return (
    <div className="admin-filters" aria-label="Filter by role">
      {ROLE_FILTERS.map((role) => (
        <button
          key={role}
          type="button"
          className={`admin-chip${value === role ? " is-active" : ""}`}
          onClick={() => onChange(role)}
        >
          {role}
        </button>
      ))}
    </div>
  );
}

// Small coloured labels on a request: Overdue, Possible duplicate, Changes requested.
function RequestFlags({ request, duplicates }) {
  return (
    <span className="admin-flags">
      {request.hoursWaiting >= OVERDUE_HOURS && <span className="admin-flag is-overdue">Overdue</span>}
      {duplicates.includes(request.scfhs) && <span className="admin-flag is-duplicate">Possible duplicate</span>}
      {request.corrections && <span className="admin-flag is-info">Changes requested: {request.corrections.join(", ")}</span>}
    </span>
  );
}

// The review panel: details, checklist and the decision buttons.
function ReviewPanel({ request, isDuplicate, ticked, onTick, onApprove, onReject, onAskCorrection }) {
  const [mode, setMode] = useState(""); // "" = buttons, "fix" = correction form, "reject" = reject form
  const [fixFields, setFixFields] = useState([]); // fields chosen in the correction form
  const [fixNote, setFixNote] = useState(""); // optional extra message
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);

  const isSpecialist = request.role === BURN_SPECIALIST;
  const checklist = isSpecialist ? [...CHECKS, SPECIALIST_CHECK] : CHECKS;

  // "Approve" only works when every check is ticked.
  const allTicked = checklist.every((check) => ticked[check.key]);
  const tickedCount = checklist.filter((check) => ticked[check.key]).length;

  // Copy the SCFHS number so the admin can paste it on the SCFHS website.
  const copyNumber = () => {
    navigator.clipboard?.writeText(request.scfhs);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <article className="admin-panel" aria-label={`Review ${request.name}`}>
      {/* Who is asking */}
      <div className="admin-panel-head">
        <span className={`admin-avatar admin-avatar-large${isSpecialist ? " is-specialist" : ""}`} aria-hidden="true">
          {initials(request.name)}
        </span>
        <div>
          <h2>{request.name}</h2>
          <p className="admin-panel-role">
            {request.role}
            {isSpecialist && <span className="admin-flag is-specialist">Can answer consultations</span>}
          </p>
        </div>
      </div>

      {/* Warning when the SCFHS number is used by someone else */}
      {isDuplicate && (
        <p className="admin-warning">
          This SCFHS number is also used by another account. Check carefully before approving.
        </p>
      )}

      {/* A correction was already asked for: show what the person must fix */}
      {request.corrections && (
        <p className="admin-correction">
          <strong>Changes requested:</strong> {request.corrections.join(", ")}.
          {request.correctionNote && <> Note: “{request.correctionNote}”</>} Waiting for the person to update their request.
        </p>
      )}

      {/* Details from the registration form */}
      <dl className="admin-details">
        <div>
          <dt>SCFHS number</dt>
          <dd>
            <span className="admin-mono">{request.scfhs}</span>
            <button type="button" className="admin-copy" onClick={copyNumber}>
              {copied ? "Copied" : "Copy"}
            </button>
          </dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{request.phone}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{request.email}</dd>
        </div>
        <div>
          <dt>Sent</dt>
          <dd>{waitingText(request.hoursWaiting)}</dd>
        </div>
      </dl>

      {/* Checklist: every item must be ticked before approving */}
      <div className="admin-checklist">
        <p className="admin-checklist-title">
          Verification checklist <span>{tickedCount} / {checklist.length}</span>
        </p>
        {checklist.map((check) => (
          <label key={check.key} className="admin-check">
            <input
              type="checkbox"
              checked={Boolean(ticked[check.key])}
              onChange={(e) => onTick(check.key, e.target.checked)}
            />
            <span className="admin-check-box" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="13" height="13">
                <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            {check.label}
          </label>
        ))}
      </div>

      {/* Decision buttons */}
      {mode === "" && (
        <div className="admin-actions">
          <button type="button" className="button button-primary" onClick={onApprove} disabled={!allTicked}>
            Approve
          </button>
          <button type="button" className="button button-outline" onClick={() => setMode("fix")}>
            Request changes
          </button>
          <button type="button" className="admin-text-button" onClick={() => setMode("reject")}>
            Reject
          </button>
          {!allTicked && <p className="admin-hint">Tick every check to approve.</p>}
        </div>
      )}

      {/* "Request changes" form: choose what the person must change */}
      {mode === "fix" && (
        <div className="admin-reject">
          <p className="admin-checklist-title">What needs to be changed?</p>
          <div className="admin-filters">
            {CORRECTIONS.map((item) => {
              const chosen = fixFields.includes(item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`admin-chip${chosen ? " is-active" : ""}`}
                  // Click once to choose, click again to remove (more than one is allowed).
                  onClick={() =>
                    setFixFields((current) =>
                      chosen ? current.filter((key) => key !== item.key) : [...current, item.key]
                    )
                  }
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Preview of the instructions the person will receive */}
          {fixFields.length > 0 && (
            <ul className="admin-fix-preview">
              {CORRECTIONS.filter((item) => fixFields.includes(item.key)).map((item) => (
                <li key={item.key}>{item.message}</li>
              ))}
            </ul>
          )}

          <input
            className="admin-input"
            type="text"
            placeholder="Add a short note (optional)"
            value={fixNote}
            onChange={(e) => setFixNote(e.target.value)}
          />
          <p className="admin-hint">
            The person will receive these instructions by email, fix the fields and send the request again.
          </p>
          <div className="admin-actions">
            <button
              type="button"
              className="button button-primary"
              disabled={fixFields.length === 0}
              onClick={() => {
                onAskCorrection(fixFields, fixNote.trim());
                setMode("");
                setFixFields([]);
                setFixNote("");
              }}
            >
              Send request
            </button>
            <button type="button" className="admin-text-button" onClick={() => setMode("")}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Reject form: choose a reason */}
      {mode === "reject" && (
        <div className="admin-reject">
          <p className="admin-checklist-title">Why are you rejecting this request?</p>
          <div className="admin-filters">
            {REJECT_REASONS.map((item) => (
              <button
                key={item}
                type="button"
                className={`admin-chip${reason === item ? " is-active" : ""}`}
                onClick={() => setReason(item)}
              >
                {item}
              </button>
            ))}
          </div>
          {reason === "Other" && (
            <input
              className="admin-input"
              type="text"
              placeholder="Type the reason"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
          <p className="admin-hint">The person will see this reason by email.</p>
          <div className="admin-actions">
            <button
              type="button"
              className="button button-primary"
              disabled={!reason || (reason === "Other" && !note.trim())}
              onClick={() => onReject(reason, note.trim())}
            >
              Confirm rejection
            </button>
            <button type="button" className="admin-text-button" onClick={() => setMode("")}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

// The table of approved staff, with search and a role filter.
function StaffTable({ staff, onToggle }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  // Show only the staff that match the search text and the role filter.
  const shown = staff.filter(
    (person) =>
      matchesFilter(person.role, filter) &&
      (person.name.toLowerCase().includes(search.toLowerCase()) || person.scfhs.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="admin-staff">
      <input
        className="admin-input admin-search"
        type="search"
        placeholder="Search by name or SCFHS number"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <FilterChips value={filter} onChange={setFilter} />

      <div className="admin-table">
        {/* Header row (hidden on phones) */}
        <div className="admin-row admin-row-head">
          <span>Name</span>
          <span>Role</span>
          <span>SCFHS number</span>
          <span>Status</span>
          <span />
        </div>
        {shown.map((person) => (
          <div key={person.id} className="admin-row">
            <span className="admin-row-name">
              <span className={`admin-avatar${person.role === BURN_SPECIALIST ? " is-specialist" : ""}`} aria-hidden="true">
                {initials(person.name)}
              </span>
              <span>
                {person.name}
                <small>Approved {person.approved}</small>
              </span>
            </span>
            <span>{person.role}</span>
            <span className="admin-mono">{person.scfhs}</span>
            <span>
              <span className={`admin-status is-${person.status.toLowerCase()}`}>{person.status}</span>
            </span>
            <span className="admin-row-action">
              <button type="button" className="admin-text-button" onClick={() => onToggle(person)}>
                {person.status === "Active" ? "Suspend" : "Reactivate"}
              </button>
            </span>
          </div>
        ))}
        {shown.length === 0 && <p className="admin-empty-row">No staff match your search.</p>}
      </div>
    </div>
  );
}

export default AdminPage;