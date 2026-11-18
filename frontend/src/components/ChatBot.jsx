/* =====================================================================
   BurnCare — ChatBot.jsx
   ---------------------------------------------------------------------
   A round chat button fixed at the bottom-left of the Home page.
   Clicking it opens a small chat window.

   Each question is sent to the Flask server (POST /api/chat, see
   backend/chat.py), which asks the AI model and returns the reply.
   ===================================================================== */

import { useEffect, useRef, useState } from "react";

const WELCOME =
  "Hi! I'm the BurnCare assistant. I can explain how the site works. I can't diagnose burns or replace a doctor.";

// Quick questions shown under the welcome message.
const SUGGESTIONS = ["How does it work?", "Is it free?", "Emergency"];

// Sends one question (plus the earlier messages) to the server
// and returns the reply text.
async function getReply(text, history) {
  let res;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history }),
    });
  } catch {
    throw new Error("Can't reach the server. Please try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data.reply;
}

function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ from: "bot", text: WELCOME }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);

  // Keep the newest message in view.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, busy, open]);

  async function send(text) {
    const message = text.trim();
    if (!message || busy) return;

    // Earlier messages (without the welcome text) so follow-ups make sense.
    const history = messages.slice(1).map((m) => ({
      role: m.from === "user" ? "user" : "assistant",
      text: m.text,
    }));

    setMessages((current) => [...current, { from: "user", text: message }]);
    setInput("");
    setBusy(true);

    let reply;
    try {
      reply = await getReply(message, history);
    } catch (error) {
      reply = error.message || "Something went wrong. Please try again.";
      
    }

    setMessages((current) => [...current, { from: "bot", text: reply }]);
    setBusy(false);
  }

  function handleSubmit(event) {
    event.preventDefault();
    send(input);
  }

  return (
    <>
      {open && (
        <section className="cb-panel" role="dialog" aria-label="BurnCare assistant">
          <header className="cb-header">
            <div>
              <h2>BurnCare assistant</h2>
              <p>Not a replacement for a doctor</p>
            </div>
            <button className="cb-close" type="button" onClick={() => setOpen(false)} aria-label="Close chat">
              ×
            </button>
          </header>

          <div className="cb-messages" ref={listRef} aria-live="polite">
            {messages.map((message, index) => (
              <p className={`cb-msg ${message.from === "user" ? "cb-user" : "cb-bot"}`} key={index}>
                {message.text}
              </p>
            ))}
            {busy && <p className="cb-msg cb-bot cb-typing">…</p>}
          </div>

          {messages.length === 1 && (
            <div className="cb-chips">
              {SUGGESTIONS.map((suggestion) => (
                <button className="cb-chip" type="button" key={suggestion} onClick={() => send(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <form className="cb-form" onSubmit={handleSubmit}>
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Type your question"
              aria-label="Your question"
            />
            <button className="button button-primary button-small" type="submit" disabled={busy}>
              Send
            </button>
          </form>
        </section>
      )}

      <button
        className="cb-launcher"
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? "Close chat" : "Open chat"}
        aria-expanded={open}
      >
        {open ? (
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path
              d="M4 5.5A2.5 2.5 0 016.5 3h11A2.5 2.5 0 0120 5.5v8a2.5 2.5 0 01-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 014 13.5v-8z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </>
  );
}

export default ChatBot;
