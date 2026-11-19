/* =====================================================================
   BurnCare — components/VoiceFill.jsx
   ---------------------------------------------------------------------
   ONE "Fill by voice" button for the whole burn-details form.
   The patient taps it once. It goes through the questions one by one:
   it scrolls to the question, listens, selects the answer on the form,
   then moves on to the next question by itself.

   - A question it can't understand is asked once more, then skipped
     (the patient can tap that answer by hand).
   - The patient can still change any answer by tapping, as before.
   - Uses the speech recognition built into Chrome / Edge (no key, free).
     In other browsers nothing is shown and the form works as before.

   Props:
     steps         [{ key, label, kind, options, hint?, onResult, ask? }]
                   kind: "age" | "single" | "multi"
                   ask(answersSoFar) → false skips the question
     lang          "en-US" or "ar-SA"
     onLangChange  called with the other language when the switch is tapped
     onFocus       called with a question key to scroll to it
   ===================================================================== */

import { useEffect, useRef, useState } from "react";
import { matchAnswer } from "../voiceMatch.js";

const SpeechRecognition =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

const STOP_MESSAGES = {
  "not-allowed": "Please allow the microphone in your browser, then try again.",
  "service-not-allowed": "Please allow the microphone in your browser, then try again.",
  "audio-capture": "No microphone was found.",
  network: "Voice input needs an internet connection.",
};

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function VoiceFill({ steps, lang = "en-US", onLangChange, onFocus }) {
  const [current, setCurrent] = useState(-1); // index of the question being asked, -1 = not running
  const [note, setNote] = useState("");
  const runningRef = useRef(false);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const answersRef = useRef({}); // answers given by voice in this run

  // Stop everything if the patient leaves the page.
  useEffect(
    () => () => {
      runningRef.current = false;
      clearTimeout(timerRef.current);
      recognitionRef.current?.abort();
    },
    [],
  );

  if (!SpeechRecognition) return null;

  const finish = (message) => {
    runningRef.current = false;
    setCurrent(-1);
    setNote(message);
  };

  // A short pause so the patient can see the result before the next question.
  const later = (action) => {
    timerRef.current = setTimeout(action, 900);
  };

  const listen = (from, tries) => {
    if (!runningRef.current) return;

    // Next question that should be asked (e.g. "child unwell" only for a child).
    let index = from;
    while (index < steps.length && steps[index].ask && !steps[index].ask(answersRef.current)) index += 1;
    if (index >= steps.length) {
      finish("Done. Please check your answers below.");
      return;
    }

    const step = steps[index];
    setCurrent(index);
    onFocus?.(step.key);

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    let handled = false;

    // Not understood: once more, then skip it.
    const retryOrSkip = (message) => {
      handled = true;
      if (tries < 1) {
        setNote(`${message} Let's try once more.`);
        later(() => listen(index, tries + 1));
      } else {
        setNote(`${message} Skipped. Please tap this answer yourself.`);
        later(() => listen(index + 1, 0));
      }
    };

    recognition.onresult = (event) => {
      const heard = Array.from(event.results[0]).map((item) => item.transcript);
      let answer = null;
      for (const text of heard) {
        answer = matchAnswer(step.kind, text, step.options);
        if (answer) break;
      }
      if (!answer) {
        retryOrSkip(`Heard “${heard[0]}”, but it didn't match an answer.`);
        return;
      }
      handled = true;
      step.onResult(answer);
      answersRef.current[step.key] = answer;
      setNote(`Heard “${heard[0]}” → ${Array.isArray(answer) ? answer.join(", ") : answer}`);
      later(() => listen(index + 1, 0));
    };

    recognition.onerror = (event) => {
      if (STOP_MESSAGES[event.error]) {
        handled = true;
        finish(STOP_MESSAGES[event.error]);
      } else if (event.error === "no-speech") {
        retryOrSkip("I didn't hear anything.");
      }
    };

    recognition.onend = () => {
      if (!handled && runningRef.current) retryOrSkip("I didn't hear anything.");
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      finish("Voice input could not start. Please try again.");
    }
  };

  const start = () => {
    answersRef.current = {};
    runningRef.current = true;
    setNote("");
    listen(0, 0);
  };

  const stop = () => {
    runningRef.current = false;
    clearTimeout(timerRef.current);
    recognitionRef.current?.abort();
    setCurrent(-1);
    setNote("Voice input stopped.");
  };

  const running = current >= 0;
  const step = running ? steps[current] : null;

  return (
    <div className="vm-panel">
      <div className="vm-panel-top">
        <button type="button" className={`vm-button${running ? " is-listening" : ""}`} onClick={running ? stop : start}>
          <MicIcon />
          {running ? "Stop voice input" : "Fill by voice"}
        </button>
        <button
          type="button"
          className="vm-lang"
          onClick={() => onLangChange?.(lang === "en-US" ? "ar-SA" : "en-US")}
          disabled={running}
        >
          Voice language: {lang === "en-US" ? "English" : "العربية"}
        </button>
      </div>

      {step && (
        <div className="vm-question" aria-live="polite">
          <p className="vm-question-label">Listening… {step.label}</p>
          <p className="vm-question-hint">{step.hint || `Say: ${step.options.join(" / ")}`}</p>
        </div>
      )}

      {note && (
        <p className="vm-note" aria-live="polite">
          {note}
        </p>
      )}
    </div>
  );
}

export default VoiceFill;
