-- =====================================================================
-- BurnCare — database/schema.sql   (PostgreSQL)
-- ---------------------------------------------------------------------
-- Creates every table BurnCare needs. Run it once on an empty database:
--     psql -U postgres -d burncare -f database/schema.sql
-- (or open it in pgAdmin → Query Tool → F5).
-- Running it again DELETES the old tables and their data first.
--
-- 20 TABLES, grouped by the website pages that use them:
--
--   Register & Login pages
--     accounts               everyone with an account (patient, staff, admin)
--                            Guests have NO account → their assessments have created_by = NULL
--     patient_profiles       medical profile of a patient         (subtype of accounts)
--     admin_profiles         job title and department of an admin (subtype of accounts)
--     staff_profiles         role, SCFHS number, approval status  (subtype of accounts)
--     verification_codes     one-time codes: admin login, email verification, password reset
--   Admin page
--     staff_reviews          admin decisions on staff accounts (approve, reject, ...)
--   Home & About Us pages
--     site_content           page texts
--     team_members           "Meet the team" cards
--   Guest page (assessment form + report)
--     assessments            one burn assessment / report and its result
--     assessment_conditions  long-term conditions chosen        (weak entity)
--     referral_reasons       reasons for the result              (weak entity)
--     burn_areas             body-map areas (TBSA)               (weak entity)
--     burn_images            burn photo + AI result              (weak entity)
--   Healthcare staff pages
--     consultations          a staff member asks a burn specialist about a case
--     consultation_messages  messages in a consultation          (weak entity)
--     assessment_edits       history of changes to a report (patient or staff, old → new)
--     clinical_reviews       a staff member's final review (adjusted TBSA, final result)
--   Patient pages
--     recovery_entries       healing check-ins after the assessment (photo, warning signs)
--     chat_sessions          a conversation with the BurnCare chatbot
--     chat_messages          messages in a chatbot conversation   (weak entity)
--
-- WEAK ENTITIES: they cannot exist without their owner, and their primary
-- key is the owner's key + a partial key (e.g. assessment_id + reason_no).
-- SUBTYPES: their primary key is also the foreign key to accounts (1-to-1).
-- Actions only one role can do point to that role's table, e.g.
-- consultations.specialist_id → staff_profiles, staff_reviews.admin_id →
-- admin_profiles, so the database refuses a patient answering a consultation.
-- =====================================================================

-- Start clean: remove old tables (children first, because of foreign keys).
DROP TABLE IF EXISTS chat_messages, chat_sessions, recovery_entries, clinical_reviews,
  tbsa_adjustments, assessment_edits, consultation_messages, consultations,
  burn_images, burn_areas, referral_reasons, assessment_conditions, assessments,
  team_members, site_content, staff_reviews, verification_codes, login_verifications,
  specialist_profiles, admin_profiles, staff_profiles, patient_profiles, accounts CASCADE;


-- =====================================================================
-- REGISTER & LOGIN PAGES
-- =====================================================================

-- 1. ACCOUNTS — one row for every account. "role" decides which pages
--    the person can open. Guests are never saved here.
CREATE TABLE accounts (
  account_id      SERIAL        PRIMARY KEY,
  full_name       VARCHAR(120)  NOT NULL,
  email           VARCHAR(255)  NOT NULL UNIQUE,         -- used to log in
  phone_country   CHAR(2)       NOT NULL DEFAULT 'SA',   -- e.g. SA, AE, KW
  phone           VARCHAR(20)   NOT NULL,                -- with country code, e.g. +966512345678
  password_hash   VARCHAR(255)  NOT NULL,                -- never the real password
  role            VARCHAR(10)   NOT NULL CHECK (role IN ('patient', 'staff', 'admin')),
  email_verified  BOOLEAN       NOT NULL DEFAULT FALSE,  -- TRUE after the email code is used
  is_active       BOOLEAN       NOT NULL DEFAULT TRUE,   -- FALSE = cannot log in
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 2. PATIENT_PROFILES — medical profile (Part 2 of patient registration).
--    SUBTYPE of accounts.
CREATE TABLE patient_profiles (
  account_id         INTEGER       PRIMARY KEY REFERENCES accounts (account_id) ON DELETE CASCADE,
  date_of_birth      DATE          NOT NULL CHECK (date_of_birth >= '1900-01-01'),
  sex                VARCHAR(10)   NOT NULL CHECK (sex IN ('Female', 'Male')),
  weight_kg          NUMERIC(5,1)  CHECK (weight_kg BETWEEN 1 AND 350),       -- optional
  height_cm          NUMERIC(5,1)  CHECK (height_cm BETWEEN 30 AND 250),      -- optional
  chronic_condition  VARCHAR(120),                                            -- optional
  allergy            VARCHAR(120),                                            -- optional
  medication         VARCHAR(120),                                            -- optional
  consent_given      BOOLEAN       NOT NULL CHECK (consent_given = TRUE),
  consent_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 3. ADMIN_PROFILES — job title and department of an admin.
--    SUBTYPE of accounts. created_by = the admin who created this admin.
CREATE TABLE admin_profiles (
  account_id   INTEGER       PRIMARY KEY REFERENCES accounts (account_id) ON DELETE CASCADE,
  job_title    VARCHAR(60)   NOT NULL,
  department   VARCHAR(120),
  created_by   INTEGER       REFERENCES admin_profiles (account_id) ON DELETE SET NULL
);

-- 4. STAFF_PROFILES — healthcare staff details and approval status.
--    SUBTYPE of accounts. Staff cannot use BurnCare until status = 'approved'.
--    A burn specialist is a staff member with staff_role = 'burn_specialist'.
--    scfhs_number is NOT unique on purpose (the admin page flags duplicates).
CREATE TABLE staff_profiles (
  account_id        INTEGER      PRIMARY KEY REFERENCES accounts (account_id) ON DELETE CASCADE,
  staff_role        VARCHAR(20)  NOT NULL
                    CHECK (staff_role IN ('doctor', 'nurse', 'ems', 'burn_specialist', 'other')),
  staff_role_other  VARCHAR(80),                          -- typed role when staff_role = 'other'
  scfhs_number      VARCHAR(20)  NOT NULL,                -- SCFHS registration / licence number
  status            VARCHAR(20)  NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'changes_requested', 'approved', 'rejected', 'suspended')),
  submitted_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),  -- when the request was (re)sent
  reviewed_at       TIMESTAMPTZ,                          -- last admin decision (approval time)
  reviewed_by       INTEGER      REFERENCES admin_profiles (account_id) ON DELETE SET NULL,  -- admin
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CHECK (staff_role <> 'other' OR staff_role_other IS NOT NULL)
);
CREATE INDEX idx_staff_scfhs  ON staff_profiles (scfhs_number);
CREATE INDEX idx_staff_status ON staff_profiles (status);

-- 5. VERIFICATION_CODES — one-time codes sent by email. Only a HASH of the
--    code is saved. "purpose" says what the code is for.
CREATE TABLE verification_codes (
  code_id                 SERIAL        PRIMARY KEY,
  account_id              INTEGER       NOT NULL REFERENCES accounts (account_id) ON DELETE CASCADE,
  purpose                 VARCHAR(20)   NOT NULL
                          CHECK (purpose IN ('admin_login', 'email_verification', 'password_reset')),
  code_hash               VARCHAR(255)  NOT NULL,
  expires_at              TIMESTAMPTZ   NOT NULL,
  attempts                SMALLINT      NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  verified_at             TIMESTAMPTZ,                    -- password reset: code accepted
  reset_token_hash        VARCHAR(255),                   -- password reset: token to set the new password
  reset_token_expires_at  TIMESTAMPTZ,
  used_at                 TIMESTAMPTZ,                    -- a code can only be used once
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_codes_account ON verification_codes (account_id, purpose);


-- =====================================================================
-- ADMIN PAGE
-- =====================================================================

-- 6. STAFF_REVIEWS — every admin decision on a staff account (Activity log).
CREATE TABLE staff_reviews (
  review_id         SERIAL       PRIMARY KEY,
  staff_account_id  INTEGER      NOT NULL REFERENCES staff_profiles (account_id) ON DELETE CASCADE,
  admin_id          INTEGER      REFERENCES admin_profiles (account_id) ON DELETE SET NULL,
  action            VARCHAR(20)  NOT NULL
                    CHECK (action IN ('approve', 'reject', 'request_changes', 'suspend', 'reactivate')),
  reason            VARCHAR(120),                          -- reject reason
  requested_fields  TEXT[],                                -- request_changes: e.g. {scfhs,name}
  note              TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- =====================================================================
-- HOME & ABOUT US PAGES
-- =====================================================================

-- 7. SITE_CONTENT — texts of the Home and About Us pages (one row per text).
CREATE TABLE site_content (
  content_key  VARCHAR(40)   PRIMARY KEY,                  -- e.g. 'about.vision'
  page         VARCHAR(10)   NOT NULL CHECK (page IN ('home', 'about')),
  text_value   TEXT          NOT NULL,
  updated_by   INTEGER       REFERENCES admin_profiles (account_id) ON DELETE SET NULL,  -- admin
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 8. TEAM_MEMBERS — the "Meet the team" cards.
CREATE TABLE team_members (
  member_id      SERIAL        PRIMARY KEY,
  full_name      VARCHAR(120)  NOT NULL,
  team_role      VARCHAR(80)   NOT NULL,
  bio            TEXT          NOT NULL,
  display_order  SMALLINT      NOT NULL DEFAULT 1,
  updated_by     INTEGER       REFERENCES admin_profiles (account_id) ON DELETE SET NULL,  -- admin
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- =====================================================================
-- GUEST PAGE — ASSESSMENT FORM AND REPORT
-- =====================================================================

-- 9. ASSESSMENTS — one burn assessment (the report) and its result.
--    created_by = who filled it in (NULL = guest).
--    patient_id = the registered patient the case is about (if any). It is
--    also filled when a patient makes their own assessment, so staff can
--    open the patient's medical history from the report;
--    staff can instead type patient_name and medical_record_no.
CREATE TABLE assessments (
  assessment_id         SERIAL        PRIMARY KEY,
  report_code           VARCHAR(20)   NOT NULL UNIQUE,     -- e.g. BC-261021-7K4QX
  created_by            INTEGER       REFERENCES accounts (account_id) ON DELETE SET NULL,
  patient_id            INTEGER       REFERENCES patient_profiles (account_id) ON DELETE SET NULL,
  patient_name          VARCHAR(120),                      -- staff: patient without an account
  medical_record_no     VARCHAR(30),                       -- staff: hospital file number
  -- Emergency check
  emergency_breathing   VARCHAR(8)    NOT NULL CHECK (emergency_breathing  IN ('Yes', 'No', 'Not sure')),
  emergency_smoke       VARCHAR(8)    NOT NULL CHECK (emergency_smoke      IN ('Yes', 'No', 'Not sure')),
  emergency_responsive  VARCHAR(8)    NOT NULL CHECK (emergency_responsive IN ('Yes', 'No')),
  -- Case questions
  age_group             VARCHAR(20)   NOT NULL,
  cause                 VARCHAR(40)   NOT NULL,
  circumferential       VARCHAR(8)    NOT NULL CHECK (circumferential IN ('Yes', 'No', 'Not sure')),
  not_healed            VARCHAR(3)    NOT NULL CHECK (not_healed IN ('Yes', 'No')),
  child_unwell          VARCHAR(8)    CHECK (child_unwell IN ('Yes', 'No', 'Not sure')),  -- children only
  -- Body map + AI (empty until connected)
  tbsa_percent          NUMERIC(5,2)  CHECK (tbsa_percent BETWEEN 0 AND 100),
  burn_depth            VARCHAR(12)   CHECK (burn_depth IN ('superficial', 'partial', 'full')),
  -- Result and report
  decision              VARCHAR(12)   NOT NULL CHECK (decision IN ('burn_unit', 'local', 'none', 'pending')),
  report_status         VARCHAR(12)   NOT NULL DEFAULT 'submitted'
                        CHECK (report_status IN ('draft', 'submitted', 'reviewed')),
  first_aid_advice      TEXT,
  emergency_number      VARCHAR(10)   NOT NULL DEFAULT '997',
  pdf_path              VARCHAR(255),                      -- downloaded PDF report (later release)
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_assessments_created_by ON assessments (created_by);
CREATE INDEX idx_assessments_patient    ON assessments (patient_id);

-- 10. ASSESSMENT_CONDITIONS — long-term conditions (WEAK: assessment_id + condition_name).
CREATE TABLE assessment_conditions (
  assessment_id   INTEGER      NOT NULL REFERENCES assessments (assessment_id) ON DELETE CASCADE,
  condition_name  VARCHAR(60)  NOT NULL,
  PRIMARY KEY (assessment_id, condition_name)
);

-- 11. REFERRAL_REASONS — reasons for the result (WEAK: assessment_id + reason_no).
CREATE TABLE referral_reasons (
  assessment_id  INTEGER   NOT NULL REFERENCES assessments (assessment_id) ON DELETE CASCADE,
  reason_no      SMALLINT  NOT NULL CHECK (reason_no > 0),
  reason_text    TEXT      NOT NULL,
  PRIMARY KEY (assessment_id, reason_no)
);

-- 12. BURN_AREAS — body-map areas (WEAK: assessment_id + body_region + side).
CREATE TABLE burn_areas (
  assessment_id  INTEGER       NOT NULL REFERENCES assessments (assessment_id) ON DELETE CASCADE,
  body_region    VARCHAR(40)   NOT NULL,
  side           VARCHAR(5)    NOT NULL CHECK (side IN ('front', 'back')),
  percent        NUMERIC(5,2)  NOT NULL CHECK (percent > 0 AND percent <= 100),
  PRIMARY KEY (assessment_id, body_region, side)
);

-- 13. BURN_IMAGES — burn photo and AI result (WEAK: assessment_id + image_no).
CREATE TABLE burn_images (
  assessment_id  INTEGER       NOT NULL REFERENCES assessments (assessment_id) ON DELETE CASCADE,
  image_no       SMALLINT      NOT NULL CHECK (image_no > 0),
  original_name  VARCHAR(255),                             -- file name chosen by the user
  file_path      VARCHAR(255)  NOT NULL,                   -- where it is saved on the server
  mime_type      VARCHAR(20)   NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png')),
  size_bytes     INTEGER       NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  ai_depth       VARCHAR(12)   CHECK (ai_depth IN ('superficial', 'partial', 'full')),
  ai_confidence  NUMERIC(4,3)  CHECK (ai_confidence BETWEEN 0 AND 1),
  is_uncertain   BOOLEAN,                                  -- TRUE when confidence < 0.6
  model_version  VARCHAR(40),                              -- which AI model gave the result
  heatmap_path   VARCHAR(255),                             -- Grad-CAM image (later release)
  uploaded_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (assessment_id, image_no)
);


-- =====================================================================
-- HEALTHCARE STAFF PAGES
-- =====================================================================

-- 14. CONSULTATIONS — a staff member asks a burn specialist about a case.
CREATE TABLE consultations (
  consultation_id  SERIAL       PRIMARY KEY,
  requested_by     INTEGER      NOT NULL REFERENCES staff_profiles (account_id) ON DELETE CASCADE,
  specialist_id    INTEGER      REFERENCES staff_profiles (account_id) ON DELETE SET NULL,
  assessment_id    INTEGER      NOT NULL REFERENCES assessments (assessment_id) ON DELETE CASCADE,
  question         TEXT         NOT NULL,
  status           VARCHAR(10)  NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'closed')),
  advice           TEXT,                                    -- the specialist's recommendation
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  taken_at         TIMESTAMPTZ,                             -- a specialist took the case
  answered_at      TIMESTAMPTZ
);
CREATE INDEX idx_consultations_status ON consultations (status);

-- 15. CONSULTATION_MESSAGES — messages (WEAK: consultation_id + message_no).
CREATE TABLE consultation_messages (
  consultation_id  INTEGER      NOT NULL REFERENCES consultations (consultation_id) ON DELETE CASCADE,
  message_no       INTEGER      NOT NULL CHECK (message_no > 0),
  sender_id        INTEGER      NOT NULL REFERENCES staff_profiles (account_id) ON DELETE CASCADE,
  message_text     TEXT         NOT NULL,
  sent_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (consultation_id, message_no)
);

-- 16. ASSESSMENT_EDITS — history of every change to a report's answers.
--     A patient can edit their own report until staff review it
--     (report_status = 'reviewed'); approved staff can edit it too.
--     Each changed field is one row; a changed result is saved as field_name = 'decision'.
CREATE TABLE assessment_edits (
  edit_id        SERIAL        PRIMARY KEY,
  assessment_id  INTEGER       NOT NULL REFERENCES assessments (assessment_id) ON DELETE CASCADE,
  edited_by      INTEGER       REFERENCES accounts (account_id) ON DELETE SET NULL,  -- patient or staff
  field_name     VARCHAR(40)   NOT NULL,                   -- e.g. cause
  old_value      TEXT,
  new_value      TEXT,
  reason         TEXT,                                     -- optional (patients need not explain)
  edited_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 17. CLINICAL_REVIEWS — a staff member's final review of a case: the
--     adjusted burn size (TBSA), the final result and depth, and why.
CREATE TABLE clinical_reviews (
  clinical_review_id  SERIAL        PRIMARY KEY,
  assessment_id       INTEGER       NOT NULL REFERENCES assessments (assessment_id) ON DELETE CASCADE,
  reviewed_by         INTEGER       REFERENCES staff_profiles (account_id) ON DELETE SET NULL,  -- staff
  old_tbsa            NUMERIC(5,2)  CHECK (old_tbsa BETWEEN 0 AND 100),
  adjusted_tbsa       NUMERIC(5,2)  CHECK (adjusted_tbsa BETWEEN 0 AND 100),
  final_decision      VARCHAR(12)   NOT NULL CHECK (final_decision IN ('burn_unit', 'local', 'none')),
  final_depth         VARCHAR(12)   CHECK (final_depth IN ('superficial', 'partial', 'full')),
  reason              TEXT          NOT NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- =====================================================================
-- PATIENT PAGES
-- =====================================================================

-- 18. RECOVERY_ENTRIES — healing check-ins after an assessment.
CREATE TABLE recovery_entries (
  entry_id                   SERIAL        PRIMARY KEY,
  entry_code                 VARCHAR(12)   NOT NULL UNIQUE,
  assessment_id              INTEGER       NOT NULL REFERENCES assessments (assessment_id) ON DELETE CASCADE,
  entry_date                 DATE          NOT NULL,
  photo_name                 VARCHAR(255),
  photo_path                 VARCHAR(255),
  has_fever                  BOOLEAN       NOT NULL,
  spreading_redness_or_pain  BOOLEAN       NOT NULL,
  warning_triggered          BOOLEAN       NOT NULL,       -- TRUE → advise to seek care
  observation_notes          TEXT,
  created_at                 TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 19. CHAT_SESSIONS — a conversation with the BurnCare chatbot.
CREATE TABLE chat_sessions (
  session_id  SERIAL       PRIMARY KEY,
  account_id  INTEGER      NOT NULL REFERENCES patient_profiles (account_id) ON DELETE CASCADE,  -- patient
  started_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  ended_at    TIMESTAMPTZ
);

-- 20. CHAT_MESSAGES — messages (WEAK: session_id + message_no).
CREATE TABLE chat_messages (
  session_id  INTEGER      NOT NULL REFERENCES chat_sessions (session_id) ON DELETE CASCADE,
  message_no  INTEGER      NOT NULL CHECK (message_no > 0),
  sender      VARCHAR(5)   NOT NULL CHECK (sender IN ('user', 'bot')),
  content     TEXT         NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, message_no)
);


-- =====================================================================
-- Starting content for the Home and About Us pages.
-- =====================================================================
INSERT INTO site_content (content_key, page, text_value) VALUES
  ('home.tagline', 'home', 'Know the burn. Act in time.'),
  ('home.subtitle', 'home', 'Answer a few quick questions, mark the burn on a body map, and add a photo. BurnCare tells you whether the burn needs no treatment, can be treated locally, or needs a burn unit.'),
  ('home.description', 'home', 'Many burns sent to burn units could be treated closer to home, while some serious burns are missed. BurnCare helps anyone decide, in minutes, where a burn should be treated.'),
  ('about.intro', 'about', 'BurnCare is an AI-assisted burn referral platform. It combines a few key questions, a body map of the burned area and a photo of the burn to recommend whether a burn needs no treatment, can be treated at a local clinic, or should be transferred to a burn unit. It helps anyone who sees a burn first, from family members to healthcare staff, act quickly and with confidence.'),
  ('about.vision', 'about', 'A future where every burn patient reaches the right place of care in time, whether the burn happens at home, in a rural community, or far from a specialist burn unit.'),
  ('about.mission', 'about', 'To give the public, healthcare staff and first responders a fast and reliable way to decide where a burn should be treated, by combining established referral criteria, burn size estimation and AI photo analysis, so that serious burns reach specialist care and minor burns are treated closer to home.');

INSERT INTO team_members (full_name, team_role, bio, display_order) VALUES
  ('Dr. Lama Alzaben', 'Supervisor & Product Owner', 'Department of Information Technology, King Saud University. Guides the BurnCare team and sets the product direction.', 1),
  ('Sana Aljaber', 'Project Leader & Developer', 'Leads the BurnCare project and develops the platform and its features.', 2),
  ('Lana Alhussaini', 'Scrum Master & Developer', 'Leads the team''s Scrum process and develops the BurnCare platform.', 3),
  ('Shatha Alharthi', 'Developer', 'Software developer on the BurnCare team, building the platform and its features.', 4),
  ('Reema Al-Saud', 'Developer', 'Software developer on the BurnCare team, building the platform and its features.', 5);
