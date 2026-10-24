/* BurnCare — components/CodeBoxes.jsx
   Six boxes for a verification code. Typing jumps to the next box,
   Backspace goes back, arrows move, pasting fills every box.
   Styles: ".code-boxes" in the Forgot password part of styles.css. */

import { useEffect, useRef } from "react";

function CodeBoxes({ code, onChange, problem, disabled, attempt }) {
  const boxes = useRef([]);

  // Cursor in box 1 when it opens, and again after a wrong code.
  useEffect(() => {
    if (!disabled) boxes.current[0]?.focus();
  }, [attempt, disabled]);

  const focusBox = (index) => boxes.current[Math.max(0, Math.min(index, code.length - 1))]?.focus();

  const handleChange = (index, value) => {
    const digits = value.replace(/\D/g, ""); // numbers only
    if (!digits) return;
    const next = [...code];
    digits.split("").forEach((digit, offset) => {
      if (index + offset < next.length) next[index + offset] = digit;
    });
    onChange(next);
    focusBox(index + digits.length);
  };

  const handleKeyDown = (index, event) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      const next = [...code];
      if (next[index]) {
        next[index] = "";
      } else if (index > 0) {
        next[index - 1] = "";
        focusBox(index - 1);
      }
      onChange(next);
    } else if (event.key === "ArrowLeft") {
      focusBox(index - 1);
    } else if (event.key === "ArrowRight") {
      focusBox(index + 1);
    }
  };

  const handlePaste = (event) => {
    const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, code.length);
    if (!digits) return;
    event.preventDefault();
    onChange(Array(code.length).fill("").map((_, i) => digits[i] ?? ""));
    focusBox(digits.length);
  };

  return (
    <div className={`code-boxes${problem ? " is-missing" : ""}`} role="group" aria-label="Verification code">
      {code.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            boxes.current[index] = element;
          }}
          className={`code-box${digit ? " is-filled" : ""}`}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={code.length}
          value={digit}
          disabled={disabled}
          aria-label={`Digit ${index + 1} of ${code.length}`}
          aria-invalid={Boolean(problem)}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          style={{ "--i": index }}
        />
      ))}
    </div>
  );
}

export default CodeBoxes;