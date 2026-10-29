/* =====================================================================
   BurnCare — pages/staff/StaffConsultationsPage.jsx
   ---------------------------------------------------------------------
   Consultations (/staff/consultations).
     • Staff: the questions they sent to a burn specialist, and the
       answers. (New questions are asked from a report page.)
     • Approved burn specialists: also the questions waiting for a
       specialist. The first specialist to reply takes the case.
   Each consultation opens as a short conversation (messages).
   Data: backend/consultations.py
     GET  /api/consultations              the list
     GET  /api/consultations/<id>         one conversation
     POST /api/consultations/<id>/messages   reply
     POST /api/consultations/<id>/close      close it
   "?open=<id>" in the address opens that conversation straight away.
   Styles: "14. HEALTHCARE STAFF PAGES" in styles.css.
   ===================================================================== */

import { useCallback, useEffect, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { api } from "../../auth.js";
import { CONSULT_STATUS, isSpecialist } from "../../staffData.js";

// The groups on the page, in order.
const GROUPS = [
  { status: "open", title: "Waiting for a specialist" },
  { status: "answered", title: "Answered" },
  { status: "closed", title: "Closed" },
];

function StaffConsultationsPage() {
  const { account } = useOutletContext();
  const specialist = isSpecialist(account);
  const [searchParams, setSearchParams] = useSearchParams();
  const openId = Number(searchParams.get("open")) || null;
  const [list, setList] = useState(null); // null = loading, "error", or the list

  const load = useCallback(
    () =>
      api("/api/consultations")
        .then((data) => setList(data.consultations))
        .catch(() => setList("error")),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id) => setSearchParams(openId === id ? {} : { open: String(id) }, { replace: true });

  return (
    <div className="patient-page">
      <header className="staff-page-head">
        <div>
          <h1>Consultations</h1>
          <p>
            {specialist
              ? "Answer questions from other staff about their patients' burns. The first specialist to reply takes the case."
              : "Questions you sent to a burn specialist, and their answers. To ask a new question, open a report."}
          </p>
        </div>
        {!specialist && (
          <Link to="/staff/reports" className="button button-secondary">
            Reports
          </Link>
        )}
      </header>

      {list === null && <p className="patient-empty">Loading consultations…</p>}
      {list === "error" && <p className="patient-empty">We couldn&apos;t load the consultations. Please refresh the page.</p>}
      {Array.isArray(list) && list.length === 0 && (
        <section className="patient-card">
          <p className="patient-empty">
            {specialist
              ? "No questions are waiting. New questions from staff will appear here."
              : "You haven't asked a specialist yet. Open a report and use “Ask a burn specialist”."}
          </p>
        </section>
      )}

      {Array.isArray(list) &&
        GROUPS.map(({ status, title }) => {
          const items = list.filter((c) => c.status === status);
          if (items.length === 0) return null;
          return (
            <section key={status} className="patient-card" aria-labelledby={`group-${status}`}>
              <div className="patient-card-head">
                <h2 id={`group-${status}`}>{title}</h2>
                <span className="staff-count">{items.length}</span>
              </div>
              <ul className="staff-consult-list">
                {items.map((c) => (
                  <ConsultationItem
                    key={c.id}
                    consultation={c}
                    open={openId === c.id}
                    onToggle={() => toggle(c.id)}
                    onChanged={load}
                    account={account}
                  />
                ))}
              </ul>
            </section>
          );
        })}
    </div>
  );
}

function ConsultationItem({ consultation, open, onToggle, onChanged, account }) {
  const status = CONSULT_STATUS[consultation.status] ?? CONSULT_STATUS.open;
  return (
    <li className={`staff-consult${open ? " is-open" : ""}`}>
      <button type="button" className="staff-consult-head" onClick={onToggle} aria-expanded={open}>
        <span className="staff-consult-main">
          <span className="staff-consult-question">{consultation.question}</span>
          <span className="staff-report-meta">
            {consultation.reportCode} · Asked by {consultation.askedBy} · {consultation.createdAt}
          </span>
        </span>
        <span className={`staff-approval ${status.tone}`}>{status.label}</span>
      </button>
      {open && <Conversation id={consultation.id} reportCode={consultation.reportCode} onChanged={onChanged} account={account} />}
    </li>
  );
}

// One consultation: the question, the messages, and a reply box.
function Conversation({ id, reportCode, onChanged, account }) {
  const [thread, setThread] = useState(null);
  const [problem, setProblem] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(
    () =>
      api(`/api/consultations/${id}`)
        .then(setThread)
        .catch((error) => setProblem(error.message)),
    [id],
  );

  useEffect(() => {
    load();
  }, [load]);

  const send = async (event) => {
    event.preventDefault();
    if (!reply.trim()) return setProblem("Please write a message.");
    setSending(true);
    try {
      await api(`/api/consultations/${id}/messages`, { method: "POST", body: { text: reply.trim() } });
      setReply("");
      setProblem("");
      await load();
      onChanged();
    } catch (error) {
      setProblem(error.message);
    } finally {
      setSending(false);
    }
  };

  const close = async () => {
    try {
      await api(`/api/consultations/${id}/close`, { method: "POST" });
      await load();
      onChanged();
    } catch (error) {
      setProblem(error.message);
    }
  };

  if (!thread) return <div className="staff-thread">{problem ? <p className="field-error">{problem}</p> : <p className="patient-note">Loading…</p>}</div>;

  const canReply = thread.status !== "closed";
  const specialist = isSpecialist(account);

  return (
    <div className="staff-thread">
      <ol className="staff-messages">
        <li className="staff-message is-question">
          <span className="staff-message-from">Question</span>
          <p className="staff-pre">{thread.question}</p>
        </li>
        {thread.messages.map((m) => (
          <li key={m.id} className={`staff-message${m.from === account.fullName ? " is-mine" : ""}`}>
            <span className="staff-message-from">
              {m.from} · {m.sentAt}
            </span>
            <p className="staff-pre">{m.text}</p>
          </li>
        ))}
      </ol>

      {canReply ? (
        <form onSubmit={send} noValidate className="staff-reply">
          <label className="visually-hidden" htmlFor={`reply-${id}`}>
            Your message
          </label>
          <textarea
            id={`reply-${id}`}
            className="staff-textarea"
            rows={3}
            maxLength={2500}
            value={reply}
            onChange={(event) => {
              setReply(event.target.value);
              setProblem("");
            }}
            placeholder={specialist && thread.status === "open" ? "Your advice and suggested next steps…" : "Write a message…"}
          />
          {problem && <p className="field-error">{problem}</p>}
          <div className="staff-form-actions">
            <Link to={`/staff/reports/${reportCode}`} className="patient-card-link">
              Open the report
            </Link>
            {thread.status === "answered" && (
              <button type="button" className="button button-secondary" onClick={close}>
                Close consultation
              </button>
            )}
            <button type="submit" className="button button-primary" disabled={sending}>
              {sending ? "Sending…" : specialist && thread.status === "open" ? "Send advice" : "Send"}
            </button>
          </div>
        </form>
      ) : (
        <div className="staff-form-actions">
          <span className="patient-note">This consultation is closed.</span>
          <Link to={`/staff/reports/${reportCode}`} className="patient-card-link">
            Open the report
          </Link>
        </div>
      )}
    </div>
  );
}

export default StaffConsultationsPage;