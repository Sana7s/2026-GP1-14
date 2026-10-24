/* =====================================================================
   BurnCare — pages/FirstAidPage.jsx
   ---------------------------------------------------------------------
   The full first-aid guide (/patient/first-aid), opened from the
   "First aid for a new burn" strip on the patient homepage.
     1. When to call 997, and when to go to hospital today
     2. Five steps for a heat burn (stop, cool, remove, warm, cover)
     3. Do / don't
     4. Chemical and electrical burns
     5. Then: check the burn with BurnCare
   Source: British Burn Association (BBA), First Aid Clinical Practice
   Guidelines — "cool the burn, warm the patient": cool running tap water
   for 20 minutes, within 3 hours; no ice; cover with cling film.
   Styles: section "12. FIRST AID GUIDE" in styles.css.
   ===================================================================== */

import { Link } from "react-router-dom";
import { Chevron } from "../components/Chevron.jsx";

// Call 997 straight away if any of these is true (the same signs as the
// emergency check at the start of the assessment).
const CALL_997 = [
  "Struggling to breathe, a rough voice, or coughing after smoke",
  "Burned in a fire inside a room or car, or soot around the nose or mouth",
  "Not awake or not responding normally",
  "A large burn, or a high-voltage electrical burn",
];

// Not an emergency call, but needs a doctor or hospital the same day
// (these match the BBA referral reasons BurnCare checks).
const SEE_DOCTOR_TODAY = [
  "The burn is on the face, hands, feet or genitals",
  "It goes all the way around an arm, leg, finger, neck or chest",
  "It is a chemical or electrical burn, even a small one",
  "A baby or child has a burn with blisters, or seems unwell",
  "The person has diabetes or another long-term condition",
];

// The five steps for a heat burn (hot liquid, steam, fire, hot object).
const STEPS = [
  {
    title: "Stop the burning",
    text: "Move away from the heat. If clothes are on fire: stop, drop to the ground and roll. Make sure you are safe before helping.",
  },
  {
    title: "Cool the burn for 20 minutes",
    text: "Hold it under cool running tap water for 20 minutes. Start as soon as possible; it still helps up to 3 hours after the burn. Stop at 20 minutes.",
    highlight: "20 minutes · within 3 hours",
  },
  {
    title: "Remove clothing and jewellery",
    text: "While cooling, take off clothes, nappies, rings, watches and other jewellery near the burn. Leave anything that is stuck to the skin.",
  },
  {
    title: "Keep the person warm",
    text: "Cool the burn, but warm the person. Cover the parts of the body that are not burned, especially in children and older people.",
  },
  {
    title: "Cover the burn",
    text: "After cooling, lay loose strips of cling film on the burn, or use a clean cloth that doesn't shed fluff. Don't wrap cling film around an arm or leg, and don't put it on the face.",
  },
];

const DO_NOT = [
  "Ice or iced water",
  "Butter, oil, toothpaste or creams",
  "Bursting blisters",
  "Cotton wool or fluffy dressings",
  "Sticky plasters on the burn",
  "Pulling off stuck clothing",
];

const SPECIAL = [
  {
    title: "Chemical burn",
    points: [
      "Protect yourself (gloves) and brush off any dry powder first.",
      "Rinse with plenty of running water for at least 20 minutes.",
      "Don't try to neutralise the chemical with another product.",
      "Get medical help today, and take the chemical's container or name with you.",
    ],
  },
  {
    title: "Electrical burn",
    points: [
      "Don't touch the person until the power is switched off.",
      "Get it checked at a hospital, even if the burn looks small: the damage can be deep.",
      "Call 997 for a high-voltage injury, or if the person collapsed or feels their heart racing.",
      "Once it's safe, cool the burn for 20 minutes like any other burn.",
    ],
  },
];

function FirstAidPage() {
  return (
    <div className="patient-page first-aid-page">
      {/* ===== Title ===== */}
      <header className="first-aid-header">
        <p className="first-aid-kicker">First aid</p>
        <h1>What to do right after a burn</h1>
        <p className="first-aid-lead">
          Quick, correct first aid makes burns heal faster and scar less. Follow these steps, then check the burn with
          BurnCare.
        </p>
      </header>

      {/* ===== 1. When to call 997 ===== */}
      <section className="first-aid-call" aria-labelledby="call-title">
        <div className="first-aid-call-head">
          <span className="first-aid-call-icon" aria-hidden="true">
            !
          </span>
          <h2 id="call-title">
            Call <span>997</span> now if:
          </h2>
        </div>
        <ul>
          {CALL_997.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="first-aid-call-note">Start cooling the burn while you wait for help.</p>

        <h2 className="first-aid-today-title">Go to a doctor or hospital today if:</h2>
        <ul>
          {SEE_DOCTOR_TODAY.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      {/* ===== 2. Five steps ===== */}
      <section className="patient-card" aria-labelledby="steps-title">
        <div className="patient-card-head">
          <h2 id="steps-title">For a heat burn: 5 steps</h2>
        </div>
        <ol className="first-aid-steps">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="first-aid-step-number" aria-hidden="true">
                {index + 1}
              </span>
              <div>
                <h3>{step.title}</h3>
                {step.highlight && <p className="first-aid-highlight">{step.highlight}</p>}
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="patient-grid">
        {/* ===== 3. Do not ===== */}
        <section className="patient-card" aria-labelledby="dont-title">
          <div className="patient-card-head">
            <h2 id="dont-title">Never put on a burn</h2>
          </div>
          <ul className="first-aid-dont">
            {DO_NOT.map((item) => (
              <li key={item}>
                <CrossIcon />
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* ===== 4. Chemical and electrical ===== */}
        <section className="patient-card" aria-labelledby="special-title">
          <div className="patient-card-head">
            <h2 id="special-title">Chemical or electrical burns</h2>
          </div>
          {SPECIAL.map((group) => (
            <div key={group.title} className="first-aid-special">
              <h3>{group.title}</h3>
              <ul>
                {group.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </div>

      {/* ===== 5. Then check the burn ===== */}
      <section className="patient-card first-aid-next" aria-labelledby="next-title">
        <div>
          <h2 id="next-title">After first aid, check the burn</h2>
          <p>Answer a few questions and mark the burn on the body map. BurnCare tells you where to get care.</p>
        </div>
        <Link to="/patient/assessment" className="button button-primary">
          Start assessment <Chevron />
        </Link>
      </section>

      <p className="first-aid-source">
        Based on the British Burn Association first aid guidelines. This guide does not replace advice from a
        healthcare professional.
      </p>
    </div>
  );
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export default FirstAidPage;