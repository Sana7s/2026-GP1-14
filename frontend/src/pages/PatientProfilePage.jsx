/* =====================================================================
   BurnCare — pages/PatientProfilePage.jsx
   ---------------------------------------------------------------------
   The patient's profile (/patient/profile). Same sections as the
   wireframe:
     • Header: profile picture, "Profile", why it matters
     • Personal details: name, date of birth (with age), weight,
       height, phone, email
     • Health information: diabetes (No / Type 1 / Type 2 / Not sure),
       other conditions (optional)
     • Save changes
     • Account: Change password
   "Log out" lives in the profile-picture menu in the top bar.
   Uses the Register page field styles (.field, .text-input...).
   Styles: "Profile page" part of section 10 in styles.css.
   ===================================================================== */

import { useState } from "react";
import { Link } from "react-router-dom";
import { Chevron } from "../components/Chevron.jsx";
import { DEMO_PATIENT, DIABETES_OPTIONS, initials } from "../patientData.js";

// Today's date as YYYY-MM-DD (a birth date can't be after it).
const todayISO = () => new Date().toISOString().slice(0, 10);

// Whole years between a YYYY-MM-DD birth date and today.
function ageFrom(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hadBirthday =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hadBirthday) age -= 1;
  return age >= 0 ? age : null;
}

// Fields checked when saving, in order, with the name for messages.
const PROFILE_FIELDS = ["name", "dob", "weight", "height", "phone", "email"];

// Checks ONE field and returns a problem message, or "" if it is fine.
// Same rules as the Register page.
function checkField(key, values) {
  const value = String(values[key] ?? "").trim();

  switch (key) {
    case "name":
      if (!value) return "Please enter your full name.";
      if (value.length < 3) return "Your name looks too short.";
      return "";
    case "dob":
      if (!value) return "Please enter your date of birth.";
      if (value > todayISO()) return "Your date of birth can't be in the future.";
      if (value < "1900-01-01") return "Please check the year of your date of birth.";
      return "";
    case "weight":
      if (!value) return "Please enter your weight.";
      if (!(Number(value) >= 1 && Number(value) <= 350)) return "Enter a weight between 1 and 350 kg.";
      return "";
    case "height":
      if (!value) return "Please enter your height.";
      if (!(Number(value) >= 30 && Number(value) <= 250)) return "Enter a height between 30 and 250 cm.";
      return "";
    case "phone": {
      if (!value) return "Please enter your phone number.";
      const digits = value.replace(/[\s\-()]/g, "");
      if (!/^\+?\d{9,15}$/.test(digits)) return "Enter a valid phone number, e.g. 05X XXX XXXX.";
      return "";
    }
    case "email":
      if (!value) return "Please enter your email.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Enter a valid email, e.g. name@example.com.";
      return "";
    default:
      return "";
  }
}

function PatientProfilePage() {
  const [profile, setProfile] = useState({ ...DEMO_PATIENT });
  const [saved, setSaved] = useState({ ...DEMO_PATIENT }); // last saved version
  const [problems, setProblems] = useState({});
  const [status, setStatus] = useState(""); // "saved" message after saving

  const age = ageFrom(profile.dob);
  const hasChanges = JSON.stringify(profile) !== JSON.stringify(saved);

  // Save what was typed. If that field had a problem, check it again
  // so the red message disappears as soon as it's fixed.
  const update = (key, value) => {
    const next = { ...profile, [key]: value };
    setProfile(next);
    setStatus("");
    if (problems[key]) setProblems({ ...problems, [key]: checkField(key, next) });
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const found = {};
    PROFILE_FIELDS.forEach((key) => {
      const message = checkField(key, profile);
      if (message) found[key] = message;
    });
    setProblems(found);

    const first = PROFILE_FIELDS.find((key) => found[key]);
    if (first) {
      document.getElementById(`profile-${first}`)?.focus();
      return;
    }

    // TODO (backend): send `profile` to Flask (e.g. PUT /api/patient/profile)
    // and only show "saved" when it succeeds.
    setSaved({ ...profile });
    setStatus("saved");
  };

  return (
    <div className="profile-page">
      {/* ===== Header ===== */}
      <header className="profile-header">
        <span className="profile-avatar" aria-hidden="true">
          {initials(profile.name || "?")}
        </span>
        <div>
          <h1>Profile</h1>
          <p>Age and diabetes status are used in every assessment.</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} noValidate>
        {/* ===== Personal details ===== */}
        <section className="patient-card profile-card" aria-labelledby="personal-title">
          <h2 id="personal-title">Personal details</h2>
          <div className="profile-fields">
            <ProfileField
              id="name"
              label="Full name"
              autoComplete="name"
              value={profile.name}
              onChange={update}
              problem={problems.name}
            />
            <ProfileField
              id="dob"
              label="Date of birth"
              extra={age !== null ? `age ${age}` : null}
              type="date"
              min="1900-01-01"
              max={todayISO()}
              value={profile.dob}
              onChange={update}
              problem={problems.dob}
            />
            <div className="profile-pair">
              <ProfileField
                id="weight"
                label="Weight (kg)"
                type="number"
                inputMode="decimal"
                min="1"
                max="350"
                value={profile.weight}
                onChange={update}
                problem={problems.weight}
              />
              <ProfileField
                id="height"
                label="Height (cm)"
                type="number"
                inputMode="decimal"
                min="30"
                max="250"
                value={profile.height}
                onChange={update}
                problem={problems.height}
              />
            </div>
            <ProfileField
              id="phone"
              label="Phone number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="05X XXX XXXX"
              value={profile.phone}
              onChange={update}
              problem={problems.phone}
            />
            <ProfileField
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              value={profile.email}
              onChange={update}
              problem={problems.email}
            />
          </div>
        </section>

        {/* ===== Health information ===== */}
        <section className="patient-card profile-card" aria-labelledby="health-title">
          <h2 id="health-title">Health information</h2>
          <div className="profile-fields">
            <fieldset className="field profile-fieldset">
              <legend className="field-label">Do you have diabetes?</legend>
              <div className="diabetes-options">
                {DIABETES_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`diabetes-option${profile.diabetes === option.value ? " is-selected" : ""}`}
                    aria-pressed={profile.diabetes === option.value}
                    onClick={() => update("diabetes", option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <ProfileField
              id="otherConditions"
              label="Other conditions"
              optional
              placeholder="e.g. high blood pressure"
              value={profile.otherConditions}
              onChange={update}
            />
          </div>
        </section>

        {/* ===== Save ===== */}
        <div className="profile-save">
          <button type="submit" className="button button-primary profile-save-button" disabled={!hasChanges}>
            Save changes
          </button>
          {status === "saved" && !hasChanges && (
            <p className="profile-saved" role="status">
              <CheckIcon />
              Changes saved
            </p>
          )}
        </div>
      </form>

      {/* ===== Account ===== */}
      <section className="patient-card profile-account" aria-label="Account">
        <Link to="/patient/change-password" className="profile-account-link">
          <span>Change password</span>
          <Chevron />
        </Link>
      </section>
    </div>
  );
}

// One labelled text box, styled like the Register page fields.
//   extra    → small grey text after the label (e.g. "age 34")
//   optional → shows "(optional)" after the label
function ProfileField({ id, label, extra, optional, value, onChange, problem, ...inputProps }) {
  return (
    <div className={`field${problem ? " is-missing is-flashing" : ""}`}>
      <label className="field-label" htmlFor={`profile-${id}`}>
        {label}
        {extra && <span className="profile-label-extra">· {extra}</span>}
        {optional && <span className="optional-mark">Optional</span>}
      </label>
      <div className="text-input">
        <input
          id={`profile-${id}`}
          value={value}
          onChange={(e) => onChange(id, e.target.value)}
          aria-invalid={Boolean(problem)}
          aria-describedby={problem ? `profile-${id}-error` : undefined}
          {...inputProps}
        />
      </div>
      {problem && (
        <p className="field-error" id={`profile-${id}-error`}>
          {problem}
        </p>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default PatientProfilePage;