/* =====================================================================
   BurnCare — pages/PatientProfilePage.jsx
   ---------------------------------------------------------------------
   The patient's profile (/patient/profile), loaded from and saved to
   the database through Flask:
     GET /api/patient/profile   when the page opens
     PUT /api/patient/profile   on "Save changes"
   Sections:
     • Header: profile picture (initials), "Profile", why it matters
     • Personal details: name, date of birth (with age), sex, weight,
       height, phone; the email is shown but can't be changed here
     • Health information: chronic condition, allergy, medication — the
       same lists as the Register page, with "Other (not listed)"
     • Save changes
     • Account: Change password
   "Log out" lives in the profile-picture menu in the top bar.
   Styles: "Profile page" part of section 10 in styles.css.
   ===================================================================== */

import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { Chevron } from "../components/Chevron.jsx";
import { api } from "../auth.js";
import { ALLERGIES, CHRONIC_CONDITIONS, MEDICATIONS, OTHER_OPTION, initials } from "../patientData.js";

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

// The three health lists: which box, its list, and the label.
const HEALTH = [
  { key: "condition", label: "Chronic condition", options: CHRONIC_CONDITIONS, placeholder: "Choose a condition", other: "e.g. Thyroid disease" },
  { key: "allergy", label: "Allergy", options: ALLERGIES, placeholder: "Choose an allergy", other: "e.g. Codeine" },
  { key: "medication", label: "Current medication", options: MEDICATIONS, placeholder: "Choose a medication", other: "e.g. Levothyroxine" },
];

// Saved text → the list choice (+ typed text when it isn't in the list).
function toChoice(text, options) {
  if (!text) return { choice: "", other: "" };
  if (options.includes(text)) return { choice: text, other: "" };
  return { choice: OTHER_OPTION, other: text };
}

// Profile from Flask → the values in the form.
function toForm(profile) {
  const form = {
    fullName: profile.fullName,
    dob: profile.dob,
    sex: profile.sex,
    weight: String(profile.weight ?? ""),
    height: String(profile.height ?? ""),
    phone: profile.phone,
  };
  for (const item of HEALTH) {
    const { choice, other } = toChoice(profile[item.key], item.options);
    form[item.key] = choice;
    form[`${item.key}Other`] = other;
  }
  return form;
}

// Fields checked when saving, in order.
const FIELDS = ["fullName", "dob", "sex", "weight", "height", "phone", "conditionOther", "allergyOther", "medicationOther"];

// Checks ONE field and returns a problem message, or "" if it is fine.
// Same rules as the Register page (and the server checks them again).
function checkField(key, values) {
  const value = String(values[key] ?? "").trim();
  switch (key) {
    case "fullName":
      if (!value) return "Please enter your full name.";
      if (value.length < 3) return "Your name looks too short.";
      return "";
    case "dob":
      if (!value) return "Please enter your date of birth.";
      if (value > todayISO()) return "Your date of birth can't be in the future.";
      if (value < "1900-01-01") return "Please check the year of your date of birth.";
      return "";
    case "sex":
      return value ? "" : "Please choose your sex.";
    case "weight":
      if (value && !(Number(value) >= 1 && Number(value) <= 350)) return "Enter a weight between 1 and 350 kg.";
      return "";
    case "height":
      if (value && !(Number(value) >= 30 && Number(value) <= 250)) return "Enter a height between 30 and 250 cm.";
      return "";
    case "phone": {
      const digits = value.replace(/[\s\-()]/g, "");
      if (!digits) return "Please enter your phone number.";
      if (digits.startsWith("0")) return "Don't start with 0. Type the number that comes after the country code.";
      if (!/^\d{8,10}$/.test(digits)) return "Enter a valid mobile number.";
      return "";
    }
    case "conditionOther":
    case "allergyOther":
    case "medicationOther": {
      const listKey = key.replace("Other", "");
      if (values[listKey] === OTHER_OPTION && !value) return "Please type it here.";
      return "";
    }
    default:
      return "";
  }
}

function PatientProfilePage() {
  const { setAccount } = useOutletContext(); // to update the name in the top bar
  const [info, setInfo] = useState(null); // what Flask sent (email, phone code)
  const [form, setForm] = useState(null); // the values in the boxes
  const [saved, setSaved] = useState(null); // the last saved values
  const [loadProblem, setLoadProblem] = useState("");
  const [problems, setProblems] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverMessage, setServerMessage] = useState("");
  const [status, setStatus] = useState(""); // "saved" after saving

  // Load the profile from the database once.
  useEffect(() => {
    let isCurrent = true;
    api("/api/patient/profile")
      .then(({ profile }) => {
        if (!isCurrent) return;
        setInfo(profile);
        setForm(toForm(profile));
        setSaved(toForm(profile));
      })
      .catch(() => isCurrent && setLoadProblem("We couldn't load your profile. Please refresh the page."));
    return () => {
      isCurrent = false;
    };
  }, []);

  if (loadProblem) return <p className="patient-empty profile-loading">{loadProblem}</p>;
  if (!form) return <p className="patient-empty profile-loading">Loading your profile…</p>;

  const age = ageFrom(form.dob);
  const hasChanges = JSON.stringify(form) !== JSON.stringify(saved);

  // Save what was typed; re-check the box if it already shows a problem.
  const update = (key, value) => {
    const next = { ...form, [key]: value };
    setForm(next);
    setStatus("");
    setServerMessage("");
    if (problems[key]) setProblems({ ...problems, [key]: checkField(key, next) });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    const found = {};
    for (const key of FIELDS) {
      const message = checkField(key, form);
      if (message) found[key] = message;
    }
    setProblems(found);
    const first = FIELDS.find((key) => found[key]);
    if (first) {
      document.getElementById(`profile-${first}`)?.focus();
      return;
    }

    // The list choice, or the typed text for "Other (not listed)".
    const pick = (key) => (form[key] === OTHER_OPTION ? form[`${key}Other`].trim() : form[key]);
    setSaving(true);
    setServerMessage("");
    try {
      const data = await api("/api/patient/profile", {
        method: "PUT",
        body: {
          fullName: form.fullName.trim(),
          dob: form.dob,
          sex: form.sex,
          weight: form.weight,
          height: form.height,
          phoneCountry: info.phoneCountry,
          phone: form.phone,
          condition: pick("condition"),
          allergy: pick("allergy"),
          medication: pick("medication"),
        },
      });
      setInfo(data.profile);
      setForm(toForm(data.profile));
      setSaved(toForm(data.profile));
      setAccount(data.user); // the top bar shows the new name
      setStatus("saved");
    } catch (error) {
      // e.g. a phone problem from the server → under the phone box.
      if (error.field && FIELDS.includes(error.field)) {
        setProblems({ [error.field]: error.message });
        document.getElementById(`profile-${error.field}`)?.focus();
      } else {
        setServerMessage(error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-page">
      {/* ===== Header ===== */}
      <header className="profile-header">
        <span className="profile-avatar" aria-hidden="true">
          {initials(form.fullName || "?")}
        </span>
        <div>
          <h1>Profile</h1>
          <p>Your age and health information help BurnCare assess your burns.</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} noValidate>
        {/* ===== Personal details ===== */}
        <section className="patient-card profile-card" aria-labelledby="personal-title">
          <h2 id="personal-title">Personal details</h2>
          <div className="profile-fields">
            <ProfileField
              id="fullName"
              label="Full name"
              autoComplete="name"
              value={form.fullName}
              onChange={update}
              problem={problems.fullName}
            />
            <ProfileField
              id="dob"
              label="Date of birth"
              extra={age !== null ? `age ${age}` : null}
              type="date"
              min="1900-01-01"
              max={todayISO()}
              value={form.dob}
              onChange={update}
              problem={problems.dob}
            />
            <div className={`field${problems.sex ? " is-missing" : ""}`}>
              <label className="field-label" htmlFor="profile-sex">
                Sex
              </label>
              <select id="profile-sex" value={form.sex} onChange={(e) => update("sex", e.target.value)}>
                <option value="" disabled hidden>
                  Choose
                </option>
                <option>Female</option>
                <option>Male</option>
              </select>
              {problems.sex && <p className="field-error">{problems.sex}</p>}
            </div>
            <div className="profile-pair">
              <ProfileField
                id="weight"
                label="Weight (kg)"
                optional
                type="number"
                inputMode="decimal"
                min="1"
                max="350"
                value={form.weight}
                onChange={update}
                problem={problems.weight}
              />
              <ProfileField
                id="height"
                label="Height (cm)"
                optional
                type="number"
                inputMode="decimal"
                min="30"
                max="250"
                value={form.height}
                onChange={update}
                problem={problems.height}
              />
            </div>
            <ProfileField
              id="phone"
              label="Phone number"
              prefix={info.phoneCode}
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="5X XXX XXXX"
              value={form.phone}
              onChange={update}
              problem={problems.phone}
            />
            <div className="field">
              <label className="field-label" htmlFor="profile-email">
                Email
              </label>
              <div className="text-input is-readonly">
                <input id="profile-email" type="email" value={info.email} readOnly aria-describedby="profile-email-hint" />
              </div>
              <p className="field-hint" id="profile-email-hint">
                Your email is how you sign in, so it can&apos;t be changed here.
              </p>
            </div>
          </div>
        </section>

        {/* ===== Health information ===== */}
        <section className="patient-card profile-card" aria-labelledby="health-title">
          <h2 id="health-title">Health information</h2>
          <div className="profile-fields">
            {HEALTH.map((item) => (
              <div key={item.key} className="field">
                <label className="field-label" htmlFor={`profile-${item.key}`}>
                  {item.label} <span className="optional-mark">Optional</span>
                </label>
                <select id={`profile-${item.key}`} value={form[item.key]} onChange={(e) => update(item.key, e.target.value)}>
                  <option value="" disabled hidden>
                    {item.placeholder}
                  </option>
                  {item.options.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
                {form[item.key] === OTHER_OPTION && (
                  <ProfileField
                    id={`${item.key}Other`}
                    label={`Type your ${item.label.toLowerCase()}`}
                    hiddenLabel
                    placeholder={item.other}
                    maxLength={120}
                    value={form[`${item.key}Other`]}
                    onChange={update}
                    problem={problems[`${item.key}Other`]}
                  />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ===== Save ===== */}
        <div className="profile-save">
          {serverMessage && (
            <p className="field-error" role="alert">
              {serverMessage}
            </p>
          )}
          <button type="submit" className="button button-primary profile-save-button" disabled={!hasChanges || saving}>
            {saving ? "Saving…" : "Save changes"}
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
//   extra       → small grey text after the label (e.g. "age 34")
//   optional    → shows "Optional" after the label
//   prefix      → text inside the box before the input (e.g. "+966")
//   hiddenLabel → label only for screen readers (the "Other" text box)
function ProfileField({ id, label, extra, optional, prefix, hiddenLabel, value, onChange, problem, ...inputProps }) {
  return (
    <div className={`field${problem ? " is-missing is-flashing" : ""}${hiddenLabel ? " other-input" : ""}`}>
      <label className={hiddenLabel ? "visually-hidden" : "field-label"} htmlFor={`profile-${id}`}>
        {label}
        {extra && <span className="profile-label-extra">· {extra}</span>}
        {optional && <span className="optional-mark">Optional</span>}
      </label>
      <div className={`text-input${prefix ? " has-prefix" : ""}`}>
        {prefix && <span className="input-prefix">{prefix}</span>}
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