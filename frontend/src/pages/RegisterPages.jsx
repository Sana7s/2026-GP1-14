/* =====================================================================
   BurnCare 
   ---------------------------------------------------------------------
   The registration pages:
     /register          → choose Patient or Healthcare Staff
     /register/patient  → patient form (two parts)
     /register/staff    → healthcare staff form
   ===================================================================== */

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { prefersReducedMotion } from "../components/animations.jsx";
import { Chevron } from "../components/Chevron.jsx";

/* =====================================================================
   8. REGISTER PAGES ("Create your account")
   /register          → choose a role (two large cards)
   /register/staff    → one form (account info + "What is your role?")
                        → "Register"
   /register/patient  → two parts:
                            Part 1  Account info    → "Next"
                            Part 2  Medical profile → "Create account"
                          with a sliding animation between the parts.
   Required fields must be filled (and valid) before moving on. If
   something is missing or wrong, a pop-up names ONE problem at a time.
   ===================================================================== */

// The two kinds of account a visitor can create.
// "to" is the address of that role's form page.
const ACCOUNT_ROLES = [
  { value: "patient", title: "Patient", text: "Track my own cases", icon: "patient", to: "/register/patient" },
  { value: "staff", title: "Healthcare Staff", text: "Assess cases and request consultations", icon: "staff", to: "/register/staff" },
];

// The answers for "What is your role?" (healthcare staff only).
const BURN_SPECIALIST = "Burn specialist";
const STAFF_ROLES = ["Doctor", "Nurse", "EMS staff (paramedic)", BURN_SPECIALIST, "Other"];

// Only burn specialists can open the Consultations page and answer
// consultation requests from other staff. Every other role gets all the
// other staff pages, but not Consultations.
// Use this later (e.g. in the staff dashboard menu) to show or hide it:
//   {canGiveConsultations(user.staffRole) && <Link to="/consultations">…</Link>}
const canGiveConsultations = (staffRole) => staffRole === BURN_SPECIALIST;

// Countries for the phone number drop-down list.
//   code   → the country calling code shown in the list
//   length → how many digits the mobile number has AFTER the code
//   starts → the digits a mobile number can start with (after the code)
//   example → shown as the placeholder in the phone box
const COUNTRIES = [
  { id: "SA", name: "Saudi Arabia", code: "+966", length: 9, starts: "5", example: "5X XXX XXXX" },
  { id: "AE", name: "United Arab Emirates", code: "+971", length: 9, starts: "5", example: "5X XXX XXXX" },
  { id: "KW", name: "Kuwait", code: "+965", length: 8, starts: "569", example: "XXXX XXXX" },
  { id: "BH", name: "Bahrain", code: "+973", length: 8, starts: "36", example: "XXXX XXXX" },
  { id: "QA", name: "Qatar", code: "+974", length: 8, starts: "3567", example: "XXXX XXXX" },
  { id: "OM", name: "Oman", code: "+968", length: 8, starts: "79", example: "XXXX XXXX" },
  { id: "JO", name: "Jordan", code: "+962", length: 9, starts: "7", example: "7X XXX XXXX" },
  { id: "EG", name: "Egypt", code: "+20", length: 10, starts: "1", example: "1X XXXX XXXX" },
];

// Finds a country in the list above by its id (e.g. "SA").
const findCountry = (id) => COUNTRIES.find((country) => country.id === id) || COUNTRIES[0];

// Cleans what was typed in the phone box: removes spaces, dashes and brackets.
// The number must start right after the country code, WITHOUT the first 0
// (e.g. Saudi Arabia: +966 then 5X XXX XXXX, not 05X XXX XXXX).
const cleanLocalPhone = (typed) => String(typed || "").replace(/[\s\-()]/g, "");

// The full phone number with the country code, e.g. "+966512345678".
// This is the value that should be saved in the database.
const fullPhoneNumber = (values) => findCountry(values.phoneCountry).code + cleanLocalPhone(values.phone);

// Answer choices for the medical profile drop-down lists.
const SEX_OPTIONS = ["Female", "Male"];

// Choosing this option opens a text box so the patient can type their own answer.
const OTHER_OPTION = "Other (not listed)";

const CHRONIC_CONDITIONS = [
  "None",
  "Diabetes",
  "High blood pressure",
  "Heart disease",
  "Kidney disease",
  "Asthma or lung disease",
  OTHER_OPTION,
];

const MEDICATIONS = [
  "None",
  "Insulin",
  "Diabetes tablets (e.g. Metformin)",
  "Blood thinners (e.g. Warfarin, Aspirin)",
  "Blood pressure medicine",
  "Steroids (e.g. Prednisolone)",
  "Immune-suppressing medicine",
  OTHER_OPTION,
];

const ALLERGIES = [
  "None",
  "Penicillin",
  "Sulfa drugs",
  "Aspirin or anti-inflammatory drugs",
  "Latex",
  "Iodine or contrast dye",
  "Food allergy",
  OTHER_OPTION,
];

// The empty form: nothing filled in yet.
const EMPTY_ACCOUNT = {
  // Part 1 — account info (everyone)
  role: "",
  fullName: "",
  phoneCountry: "SA", // country of the phone number (Saudi Arabia by default)
  phone: "", // the number after the country code, without the first 0, e.g. 5X XXX XXXX
  email: "",
  password: "",
  confirm: "",
  // Healthcare staff only
  staffRole: "", // Doctor, Nurse, EMS staff, Burn specialist or Other
  staffRoleOther: "", // typed role when "Other" is chosen
  scfhsNumber: "", // registration number from the SCFHS professional card
  // Part 2 — medical profile (patients only)
  dob: "",
  sex: "",
  weight: "",
  height: "",
  condition: "",
  conditionOther: "", // typed answer when "Other (not listed)" is chosen
  allergies: "",
  allergiesOther: "", // typed answer when "Other (not listed)" is chosen
  medications: "",
  medicationsOther: "", // typed answer when "Other (not listed)" is chosen
  consent: false,
};

// Fields checked in Part 1, in order, with the name shown in the pop-up.
const ACCOUNT_FIELDS = [
  { key: "fullName", label: "Full name" },
  { key: "phone", label: "Phone number" },
  { key: "email", label: "Email" },
  { key: "password", label: "Password" },
  { key: "confirm", label: "Confirm password" },
];

// Extra fields checked for healthcare staff (after the email).
const STAFF_FIELDS = [
  { key: "staffRole", label: "Your role" },
  { key: "staffRoleOther", label: "Your role" },
  { key: "scfhsNumber", label: "SCFHS registration number" },
];

// Fields checked in Part 2 (patients). Weight and height are optional,
// but if they are filled in they must be sensible numbers.
const MEDICAL_FIELDS = [
  { key: "dob", label: "Date of birth" },
  { key: "sex", label: "Sex" },
  { key: "weight", label: "Weight" },
  { key: "height", label: "Height" },
  { key: "conditionOther", label: "Chronic condition" },
  { key: "allergiesOther", label: "Allergy" },
  { key: "medicationsOther", label: "Current medication" },
  { key: "consent", label: "Consent" },
];

// Today's date as YYYY-MM-DD (used so a birth date can't be in the future).
const todayISO = () => new Date().toISOString().slice(0, 10);

// Checks ONE field and returns a problem message, or "" if it is fine.
function checkAccountField(key, values) {
  const value = String(values[key] ?? "").trim();

  switch (key) {
    case "role":
      return value ? "" : "Please choose whether you are a patient or healthcare staff.";

    case "fullName":
      if (!value) return "Please enter your full name.";
      if (value.length < 3) return "Your name looks too short.";
      return "";

    case "phone": {
      if (!value) return "Please enter your phone number.";
      const country = findCountry(values.phoneCountry);
      const raw = value.replace(/[\s\-()]/g, "");

      // The country code is chosen from the list, so it must not be typed here.
      if (raw.startsWith("+") || raw.startsWith("00")) {
        return `Don't type the country code here. Choose your country from the list, then type the rest of the number.`;
      }

      const digits = cleanLocalPhone(value);
      if (!/^\d+$/.test(digits)) return "The phone number can only contain digits.";

      // The number comes right after the country code, so it must not start with 0.
      if (digits.startsWith("0")) {
        return `Don't start with 0. Type the number that comes after ${country.code}, e.g. ${country.example}.`;
      }

      // Right number of digits, and a valid first digit, for that country.
      const startsOk = country.starts.includes(digits[0]);
      if (digits.length !== country.length || !startsOk) {
        return `Enter a valid ${country.name} mobile number, e.g. ${country.example}.`;
      }
      return "";
    }

    case "email":
      if (!value) return "Please enter your email.";
      // Simple check: something@something.something
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Enter a valid email, e.g. name@example.com.";
      return "";

    case "password":
      if (!values.password) return "Please create a password.";
      if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(values.password)) {
        return "Use at least 8 characters, with at least one letter and one number.";
      }
      return "";

    case "confirm":
      if (!values.confirm) return "Please type your password again.";
      if (values.confirm !== values.password) return "The two passwords don't match.";
      return "";

    case "staffRole":
      return value ? "" : "Please choose your role.";

    // Only required when "Other" was chosen as the role.
    case "staffRoleOther":
      if (values.staffRole === "Other" && !value) return "Please type your role.";
      return "";

    // SCFHS registration number: letters, digits and dashes only.
    // BurnCare does not check it with SCFHS; the admin reviews it by hand.
    case "scfhsNumber":
      if (!value) return "Please enter your SCFHS registration number.";
      if (!/^[A-Za-z0-9-]{5,20}$/.test(value)) {
        return "Enter the number as shown on your SCFHS card (letters, digits and dashes only).";
      }
      return "";

    case "dob":
      if (!value) return "Please enter your date of birth.";
      if (value > todayISO()) return "Your date of birth can't be in the future.";
      if (value < "1900-01-01") return "Please check the year of your date of birth.";
      return "";

    case "sex":
      return value ? "" : "Please choose your sex.";

    case "weight":
      // Optional: only check it if something was typed.
      if (value && !(Number(value) >= 1 && Number(value) <= 350)) return "Enter a weight between 1 and 350 kg.";
      return "";

    case "height":
      if (value && !(Number(value) >= 30 && Number(value) <= 250)) return "Enter a height between 30 and 250 cm.";
      return "";

    // Only required when "Other (not listed)" was chosen in the list above it.
    case "conditionOther":
      if (values.condition === OTHER_OPTION && !value) return "Please type your chronic condition.";
      return "";

    case "allergiesOther":
      if (values.allergies === OTHER_OPTION && !value) return "Please type your allergy.";
      return "";

    case "medicationsOther":
      if (values.medications === OTHER_OPTION && !value) return "Please type your medication.";
      return "";

    case "consent":
      return values.consent ? "" : "Please agree to share this information so your case can be assessed.";

    default:
      return "";
  }
}

// Page 1 of registration: choose Patient or Healthcare Staff.
// Each card is a link to that role's form page.
function RegisterChoicePage() {
  return (
    <section className="register-page">
      <div className="register-container register-choice">
        <header className="register-header">
          <h1>Create your account</h1>
          <p className="register-subtitle">I am joining as…</p>
        </header>

        <div className="role-cards role-cards-large">
          {ACCOUNT_ROLES.map((role, index) => (
            <Link
              key={role.value}
              to={role.to}
              className="role-card role-card-large"
              style={{ "--i": index }}
            >
              <span className="role-icon" aria-hidden="true">
                <RoleIcon name={role.icon} />
              </span>
              <span className="role-title">{role.title}</span>
              <span className="role-text">{role.text}</span>
              {/* Arrow that slides right on hover. */}
              <span className="role-arrow" aria-hidden="true">
                <Chevron />
              </span>
            </Link>
          ))}
        </div>

        <p className="register-login-link">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </section>
  );
}

// Page 2 of registration: the form for the chosen role.
// role = "patient" or "staff" (comes from the page address).
function RegisterPage({ role }) {
  const [account, setAccount] = useState({ ...EMPTY_ACCOUNT, role }); // everything the visitor entered
  const [problems, setProblems] = useState({}); // problem message per field
  const [showAlert, setShowAlert] = useState(false); // show the pop-up?
  const [showPassword, setShowPassword] = useState(false); // show password text?
  const [step, setStep] = useState(1); // which part of the form (1 or 2)
  const [direction, setDirection] = useState("forward"); // slide direction for the animation
  const [registered, setRegistered] = useState(false); // form accepted?
  const formTopRef = useRef(null);

  const isPatient = account.role === "patient";
  const roleTitle = ACCOUNT_ROLES.find((item) => item.value === account.role)?.title;

  // Part 1 fields: staff also answer "What is your role?", which comes
  // after the email and before the password (same order as on screen).
  const partOneFields = isPatient
    ? ACCOUNT_FIELDS
    : [...ACCOUNT_FIELDS.slice(0, 3), ...STAFF_FIELDS, ...ACCOUNT_FIELDS.slice(3)];

  // The fields that belong to the part currently on screen.
  const fieldsOnScreen = step === 1 ? partOneFields : MEDICAL_FIELDS;

  // The pop-up shows ONE problem at a time: the first field (in order) with a problem.
  const current = fieldsOnScreen.find(({ key }) => problems[key]);

  // Only the field named in the pop-up is outlined in red.
  const hasProblem = (key) => current?.key === key;

  // Save what the visitor typed or chose. If that field had a problem,
  // check it again so the warning disappears as soon as it's fixed.
  const update = (key, value) => {
    const next = { ...account, [key]: value };
    setAccount(next);

    // Changing the country changes the phone rules, so check the phone again.
    if (key === "phoneCountry" && problems.phone) {
      setProblems({ ...problems, phone: checkAccountField("phone", next) });
      return;
    }

    const recheckConfirm = key === "password" && problems.confirm;
    if (problems[key] || recheckConfirm) {
      const updated = { ...problems };
      if (problems[key]) updated[key] = checkAccountField(key, next);
      // Changing the password can fix (or break) the "confirm" match.
      if (recheckConfirm) updated.confirm = checkAccountField("confirm", next);
      setProblems(updated);
    }
  };

  // Close the pop-up once every problem on screen is fixed.
  useEffect(() => {
    if (showAlert && !current) setShowAlert(false);
  }, [current, showAlert]);

  // Scroll to a field, give it a small shake, and put the cursor in it.
  const goToField = (key) => {
    const box = document.getElementById(`field-${key}`);
    if (!box) return;
    box.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
    box.classList.remove("is-flashing");
    void box.offsetWidth; // restarts the shake animation
    box.classList.add("is-flashing");
    // Put the cursor in the box (a text box first, if the question has one).
    (box.querySelector("input") || box.querySelector("select, button"))?.focus({ preventScroll: true });
  };

  // Check a list of fields. Returns true if they are all fine; otherwise
  // shows the pop-up for the first problem and returns false.
  const checkFields = (fields) => {
    const found = {};
    fields.forEach(({ key }) => {
      const message = checkAccountField(key, account);
      if (message) found[key] = message;
    });
    setProblems(found);

    const first = fields.find(({ key }) => found[key]);
    if (first) {
      setShowAlert(true);
      goToField(first.key);
      return false;
    }
    return true;
  };

  // Move between Part 1 and Part 2 with the slide animation.
  const goToStep = (number) => {
    setDirection(number > step ? "forward" : "back");
    setStep(number);
    setShowAlert(false);
    formTopRef.current?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  };

  // Runs when the main button is pressed ("Register", "Next" or "Create account").
  const handleSubmit = (event) => {
    event.preventDefault(); // stop the page from reloading

    if (step === 1) {
      if (!checkFields(partOneFields)) return;
      // Patients continue to Part 2; staff are done.
      if (isPatient) {
        goToStep(2);
        return;
      }
    } else if (!checkFields(MEDICAL_FIELDS)) {
      return;
    }

    // Everything required is valid.
    // TODO (backend): send `account` to the Flask API here to create the
    // account in the database (never store the password as plain text).
    // Save the phone with its country code: fullPhoneNumber(account)
    // e.g. "+966512345678".
    // Staff accounts should start as "pending" until the admin approves them.
    setRegistered(true);
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };

  // ---------- After a valid form: confirmation screen ----------
  if (registered) {
    return (
      <section className="register-page">
        <div className="register-done">
          <span className="guest-done-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28">
              <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <h1>Welcome to BurnCare, {account.fullName.trim().split(/\s+/)[0]}.</h1>
          <p className="register-done-text">
            Your {roleTitle?.toLowerCase()} account details are complete. Account
            creation will be connected to the BurnCare server in the next step.
          </p>
          {/* Staff who are not burn specialists: remind them they can ask a specialist. */}
          {!isPatient && !canGiveConsultations(account.staffRole) && (
            <p className="register-done-text">
              You can assess cases and request a consultation from a burn specialist when you need one.
            </p>
          )}
          <div className="hero-actions">
            <Link className="button button-primary" to="/login">
              Go to login
            </Link>
            <Link className="text-link" to="/">
              Back to home <Chevron />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // ---------- The registration form ----------
  return (
    <section className="register-page">
      {/* ===== Pop-up: shows ONE problem at a time ===== */}
      {showAlert && current && (
        <div className="missing-alert" role="alert" key={current.key}>
          <span className="missing-alert-icon" aria-hidden="true">!</span>
          <div className="missing-alert-body">
            <p className="missing-alert-title">
              {account[current.key] && current.key !== "consent"
                ? "Please check this field"
                : "Required field not filled"}
            </p>
            <p className="missing-alert-text">
              <strong>{current.label}:</strong> {problems[current.key]}
            </p>
            <button type="button" className="missing-alert-go" onClick={() => goToField(current.key)}>
              Go to field <Chevron />
            </button>
          </div>
          <button
            type="button"
            className="missing-alert-close"
            onClick={() => setShowAlert(false)}
            aria-label="Close message"
          >
            ×
          </button>
        </div>
      )}

      <div className="register-container" ref={formTopRef}>
        {/* ===== Title ===== */}
        <header className="register-header">
          <h1>Create your account</h1>
          {/* Which account type was chosen, with a link to change it. */}
          <p className="register-role-chip">
            <span className="role-chip-icon" aria-hidden="true">
              <RoleIcon name={role === "staff" ? "staff" : "patient"} />
            </span>
            {roleTitle} account
            <Link to="/register">Change</Link>
          </p>
        </header>

        {/* ===== Patients only: the two-part progress bar ===== */}
        {isPatient && (
          <div className="register-stepper" aria-label={`Part ${step} of 2`}>
            {["Account info", "Medical profile"].map((label, index) => {
              const number = index + 1;
              const state = number < step ? "is-done" : number === step ? "is-current" : "";
              return (
                <div key={label} className={`stepper-item ${state}`}>
                  <span className="stepper-dot">{number < step ? "✓" : number}</span>
                  <span className="stepper-label">{label}</span>
                </div>
              );
            })}
            {/* The coral line fills up as you move to Part 2. */}
            <span className="stepper-track" aria-hidden="true">
              <span className="stepper-fill" style={{ width: step === 2 ? "100%" : "0%" }} />
            </span>
          </div>
        )}

        {/* noValidate: we show our own friendly messages instead of the browser's. */}
        <form onSubmit={handleSubmit} noValidate>
          {/* "key" makes React rebuild this box when the part changes,
              which plays the slide animation in the right direction. */}
          <div key={step} className={`register-panel slide-${direction}`}>
            {step === 1 ? (
              <>
                {/* ===== Part 1: account info ===== */}
                {isPatient && <h2 className="register-part-title">Account info</h2>}
                <div className="register-fields">
                  <TextField
                    id="fullName"
                    label="Full name"
                    type="text"
                    autoComplete="name"
                    placeholder="e.g. Sara Ahmed"
                    value={account.fullName}
                    onChange={update}
                    problem={hasProblem("fullName") && problems.fullName}
                  />
                  {/* Phone: choose the country (code) from the list, then type the number. */}
                  <PhoneField
                    country={account.phoneCountry}
                    value={account.phone}
                    onChange={update}
                    problem={hasProblem("phone") && problems.phone}
                  />
                  <TextField
                    id="email"
                    label="Email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={account.email}
                    onChange={update}
                    problem={hasProblem("email") && problems.email}
                  />
                  {/* Healthcare staff only: "What is your role?"
                      Choosing "Other" opens a box to type the role. */}
                  {!isPatient && (
                    <SelectField
                      id="staffRole"
                      label="What is your role?"
                      placeholder="Choose your role"
                      options={STAFF_ROLES}
                      value={account.staffRole}
                      onChange={update}
                      problem={hasProblem("staffRole") && problems.staffRole}
                    >
                      {account.staffRole === "Other" && (
                        <OtherInput
                          id="staffRoleOther"
                          label="Type your role"
                          placeholder="e.g. Pharmacist"
                          value={account.staffRoleOther}
                          onChange={update}
                          problem={hasProblem("staffRoleOther") && problems.staffRoleOther}
                        />
                      )}
                    </SelectField>
                  )}

                  {/* Healthcare staff only: SCFHS registration number.
                      The admin uses it to check the person before approving. */}
                  {!isPatient && (
                    <TextField
                      id="scfhsNumber"
                      label="SCFHS registration number"
                      type="text"
                      autoComplete="off"
                      placeholder="e.g. 12RM0012345"
                      value={account.scfhsNumber}
                      onChange={update}
                      problem={hasProblem("scfhsNumber") && problems.scfhsNumber}
                      hint="Found on your Saudi Commission for Health Specialties (SCFHS) professional card."
                    />
                  )}

                  <TextField
                    id="password"
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={account.password}
                    onChange={update}
                    problem={hasProblem("password") && problems.password}
                    hint="Use at least 8 characters, with a letter and a number."
                    // Button inside the box to show or hide the password.
                    action={
                      <button
                        type="button"
                        className="input-action"
                        onClick={() => setShowPassword((shown) => !shown)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    }
                  />
                  <TextField
                    id="confirm"
                    label="Confirm password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Type your password again"
                    value={account.confirm}
                    onChange={update}
                    problem={hasProblem("confirm") && problems.confirm}
                  />
                </div>
              </>
            ) : (
              <>
                {/* ===== Part 2: medical profile (patients only) ===== */}
                <div className="register-part-head">
                  <h2 className="register-part-title">Medical profile</h2>
                  {/* Back arrow → returns to Part 1 (answers are kept). */}
                  <button type="button" className="back-button" onClick={() => goToStep(1)}>
                    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                      <path d="M8 2L4 6l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Back
                  </button>
                </div>

                <div className="register-fields">
                  <TextField
                    id="dob"
                    label="Date of birth"
                    type="date"
                    min="1900-01-01"
                    max={todayISO()}
                    value={account.dob}
                    onChange={update}
                    problem={hasProblem("dob") && problems.dob}
                  />

                  <SelectField
                    id="sex"
                    label="Sex"
                    placeholder="Choose"
                    options={SEX_OPTIONS}
                    value={account.sex}
                    onChange={update}
                    problem={hasProblem("sex") && problems.sex}
                  />

                  <TextField
                    id="weight"
                    label="Weight"
                    optional
                    type="number"
                    inputMode="decimal"
                    min="1"
                    max="350"
                    placeholder="e.g. 65"
                    unit="kg"
                    value={account.weight}
                    onChange={update}
                    problem={hasProblem("weight") && problems.weight}
                  />

                  <TextField
                    id="height"
                    label="Height"
                    optional
                    type="number"
                    inputMode="decimal"
                    min="30"
                    max="250"
                    placeholder="e.g. 165"
                    unit="cm"
                    value={account.height}
                    onChange={update}
                    problem={hasProblem("height") && problems.height}
                  />

                  {/* Chronic conditions: pick from the list, or choose
                      "Other (not listed)" to type it. */}
                  <SelectField
                    id="condition"
                    label="Chronic conditions"
                    optional
                    placeholder="Choose a condition"
                    options={CHRONIC_CONDITIONS}
                    value={account.condition}
                    onChange={update}
                  >
                    {account.condition === OTHER_OPTION && (
                      <OtherInput
                        id="conditionOther"
                        label="Type your chronic condition"
                        placeholder="e.g. Thyroid disease"
                        value={account.conditionOther}
                        onChange={update}
                        problem={hasProblem("conditionOther") && problems.conditionOther}
                      />
                    )}
                  </SelectField>

                  {/* Allergies: same idea as chronic conditions. */}
                  <SelectField
                    id="allergies"
                    label="Allergies"
                    optional
                    placeholder="Choose an allergy"
                    options={ALLERGIES}
                    value={account.allergies}
                    onChange={update}
                  >
                    {account.allergies === OTHER_OPTION && (
                      <OtherInput
                        id="allergiesOther"
                        label="Type your allergy"
                        placeholder="e.g. Codeine"
                        value={account.allergiesOther}
                        onChange={update}
                        problem={hasProblem("allergiesOther") && problems.allergiesOther}
                      />
                    )}
                  </SelectField>

                  {/* Current medications: same idea as allergies. */}
                  <SelectField
                    id="medications"
                    label="Current medications"
                    optional
                    placeholder="Choose a medication"
                    options={MEDICATIONS}
                    value={account.medications}
                    onChange={update}
                  >
                    {account.medications === OTHER_OPTION && (
                      <OtherInput
                        id="medicationsOther"
                        label="Type your medication"
                        placeholder="e.g. Levothyroxine"
                        value={account.medicationsOther}
                        onChange={update}
                        problem={hasProblem("medicationsOther") && problems.medicationsOther}
                      />
                    )}
                  </SelectField>

                  {/* Consent checkbox (required). */}
                  <div id="field-consent" className={`field${hasProblem("consent") ? " is-missing" : ""}`}>
                    <label className="consent">
                      <input
                        type="checkbox"
                        checked={account.consent}
                        onChange={(e) => update("consent", e.target.checked)}
                        aria-invalid={hasProblem("consent")}
                      />
                      {/* The custom-drawn box with a tick. */}
                      <span className="consent-box" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="14" height="14">
                          <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span>
                        I agree to share this information to assess my case.{" "}
                        <span className="required-mark" aria-hidden="true">*</span>
                      </span>
                    </label>
                    {hasProblem("consent") && <p className="field-error">{problems.consent}</p>}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ===== Main button ===== */}
          <div className="register-submit">
            <button type="submit" className="button button-primary register-button">
              {step === 2 ? "Create account" : isPatient ? "Next" : "Register"}
              {step === 1 && isPatient && <Chevron />}
            </button>
            {step === 1 && (
              <p>
                Already have an account? <Link to="/login">Log in</Link>
              </p>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}

// One labelled text box (name, phone, email, passwords, date, weight…).
//   optional → shows "Optional" instead of the red star
//   unit     → small text inside the box on the right (e.g. "kg")
//   action   → a button inside the box (e.g. "Show" password)
//   problem  → the red message to show under it
function TextField({ id, label, value, onChange, problem, hint, action, unit, optional, ...inputProps }) {
  return (
    <div id={`field-${id}`} className={`field${problem ? " is-missing" : ""}`}>
      <label className="field-label" htmlFor={`account-${id}`}>
        {label}{" "}
        {optional ? (
          <span className="optional-mark">Optional</span>
        ) : (
          <span className="required-mark" aria-hidden="true">*</span>
        )}
      </label>
      <div className={`text-input${action || unit ? " has-action" : ""}`}>
        <input
          id={`account-${id}`}
          value={value}
          onChange={(e) => onChange(id, e.target.value)}
          aria-invalid={Boolean(problem)}
          aria-describedby={hint ? `hint-${id}` : undefined}
          required={!optional}
          {...inputProps}
        />
        {unit && <span className="input-unit">{unit}</span>}
        {action}
      </div>
      {problem ? (
        <p className="field-error">{problem}</p>
      ) : (
        hint && <p className="field-hint" id={`hint-${id}`}>{hint}</p>
      )}
    </div>
  );
}

// The phone number question: a country list (with the calling code) on
// the left, and the number box on the right.
function PhoneField({ country, value, onChange, problem }) {
  const chosen = findCountry(country);
  return (
    <div id="field-phone" className={`field${problem ? " is-missing" : ""}`}>
      <label className="field-label" htmlFor="account-phone">
        Phone number <span className="required-mark" aria-hidden="true">*</span>
      </label>
      <div className="phone-input">
        {/* Country list: shows the name and the code, e.g. "Saudi Arabia (+966)". */}
        <select
          id="account-phoneCountry"
          value={chosen.id}
          onChange={(e) => onChange("phoneCountry", e.target.value)}
          aria-label="Country calling code"
        >
          {COUNTRIES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.code})
            </option>
          ))}
        </select>
        <div className="text-input">
          <input
            id="account-phone"
            type="tel"
            autoComplete="tel-national"
            inputMode="tel"
            placeholder={chosen.example}
            value={value}
            onChange={(e) => onChange("phone", e.target.value)}
            aria-invalid={Boolean(problem)}
            aria-describedby="hint-phone"
            required
          />
        </div>
      </div>
      {problem ? (
        <p className="field-error">{problem}</p>
      ) : (
        <p className="field-hint" id="hint-phone">
          Choose your country, then type the rest of your number without the first 0.
        </p>
      )}
    </div>
  );
}

// One labelled drop-down list (sex, chronic conditions, allergies, medications).
// The "placeholder" text shows in the empty box but is hidden from the
// open list, so only real answers can be picked.
// "children" = anything shown under the list (e.g. the "Other" text box).
function SelectField({ id, label, options, placeholder, value, onChange, problem, optional, children }) {
  return (
    <div id={`field-${id}`} className={`field${problem ? " is-missing" : ""}`}>
      <label className="field-label" htmlFor={`account-${id}`}>
        {label}{" "}
        {optional ? (
          <span className="optional-mark">Optional</span>
        ) : (
          <span className="required-mark" aria-hidden="true">*</span>
        )}
      </label>
      <select
        id={`account-${id}`}
        value={value}
        onChange={(e) => onChange(id, e.target.value)}
        aria-invalid={Boolean(problem)}
      >
        <option value="" disabled hidden>{placeholder}</option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      {problem && <p className="field-error">{problem}</p>}
      {children}
    </div>
  );
}

// The text box that slides open under a list when "Other (not listed)"
// is chosen. It is required while it is showing.
function OtherInput({ id, label, placeholder, value, onChange, problem }) {
  return (
    <div id={`field-${id}`} className={`field other-input${problem ? " is-missing" : ""}`}>
      <label className="visually-hidden" htmlFor={`account-${id}`}>
        {label}
      </label>
      <div className="text-input">
        <input
          id={`account-${id}`}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(id, e.target.value)}
          aria-invalid={Boolean(problem)}
          autoFocus
        />
      </div>
      {problem && <p className="field-error">{problem}</p>}
    </div>
  );
}

// Simple line icons for the two role cards.
function RoleIcon({ name }) {
  const line = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  if (name === "staff") {
    // Medical cross inside a rounded square = healthcare staff.
    return (
      <svg viewBox="0 0 24 24" width="24" height="24">
        <rect {...line} x="3.5" y="3.5" width="17" height="17" rx="5" />
        <path {...line} d="M12 8v8M8 12h8" />
      </svg>
    );
  }
  // Person = patient.
  return (
    <svg viewBox="0 0 24 24" width="24" height="24">
      <circle {...line} cx="12" cy="8" r="3.5" />
      <path {...line} d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
    </svg>
  );
}

export { RegisterChoicePage, RegisterPage, canGiveConsultations, fullPhoneNumber };
