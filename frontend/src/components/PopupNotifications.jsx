/* =====================================================================
   BurnCare — components/PopupNotifications.jsx
   Pop-up messages (top right) for successes, warnings and errors.
     showPopup("Saved.")                    → a green "Success" pop-up
     showPopup("Something failed.", "error") → a red "Error" pop-up
     useNotificationState("")               → like useState, and every new
                                              message also shows as a pop-up
   <PopupNotifications /> is placed once in App.jsx.
   Styles: section "21. POP-UP MESSAGES" in styles.css.
   ===================================================================== */
/* eslint-disable react-refresh/only-export-components -- the pop-up helpers live next to the pop-up list on purpose */
import { useEffect, useRef, useState } from "react";

/** Use after the server confirms an operation succeeded (or failed). */
export function showPopup(message, type = "success") {
  if (!message) return;
  window.dispatchEvent(new CustomEvent("burncare:popup", { detail: { message: String(message), type } }));
}

/** Keep form validation state for input highlighting while showing every new warning
 * in the same accessible notification UI as action confirmations. */
export function useNotificationState(initialValue, type = "warning") {
  const [value, setValue] = useState(initialValue);
  const previousMessage = useRef("");
  useEffect(() => {
    const message = typeof value === "string"
      ? value
      : value && typeof value === "object"
        ? (typeof value.message === "string" ? value.message : Object.values(value).find((item) => typeof item === "string" && item.trim()))
        : "";
    if (message && message !== previousMessage.current) showPopup(message, type);
    previousMessage.current = message || "";
  }, [value, type]);
  return [value, setValue];
}

export default function PopupNotifications() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    let nextId = 0;
    const timers = new Map();
    const receive = (event) => {
      const { message, type = "success" } = event.detail || {};
      if (!message) return;
      const id = ++nextId;
      setItems((old) => [...old.slice(-2), { id, message, type }]);
      timers.set(id, window.setTimeout(() => {
        setItems((old) => old.filter((item) => item.id !== id));
        timers.delete(id);
      }, 4500));
    };
    window.addEventListener("burncare:popup", receive);
    return () => {
      window.removeEventListener("burncare:popup", receive);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);
  const dismiss = (id) => setItems((old) => old.filter((item) => item.id !== id));
  return (
    <div className="burncare-popup-stack" aria-label="Notifications">
      {items.map(({ id, message, type }) => (
        <div key={id} className={`burncare-popup burncare-popup--${["error", "warning", "info"].includes(type) ? type : "success"}`} role={["error", "warning"].includes(type) ? "alert" : "status"}>
          <span className="burncare-popup-icon" aria-hidden="true">{type === "success" ? "✓" : type === "info" ? "i" : "!"}</span>
          <span className="burncare-popup-content"><strong>{type === "error" ? "Error" : type === "warning" ? "Please check" : type === "info" ? "Reminder" : "Success"}</strong><span>{message}</span></span>
          <button className="burncare-popup-close" type="button" aria-label="Dismiss notification" onClick={() => dismiss(id)}>×</button>
        </div>
      ))}
    </div>
  );
}