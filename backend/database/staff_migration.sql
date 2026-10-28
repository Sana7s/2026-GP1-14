
-- BurnCare Phase 2
-- Add staff-specific assessment information.
-- Does not delete existing tables or records.

ALTER TABLE assessments
    ADD COLUMN IF NOT EXISTS injury_date DATE,
    ADD COLUMN IF NOT EXISTS pain_level SMALLINT
        CHECK (pain_level BETWEEN 0 AND 10),
    ADD COLUMN IF NOT EXISTS time_since_injury VARCHAR(40),
    ADD COLUMN IF NOT EXISTS diabetes_status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS medical_history TEXT,
    ADD COLUMN IF NOT EXISTS clinical_notes TEXT,
    ADD COLUMN IF NOT EXISTS tbsa_adjusted NUMERIC(5,2)
        CHECK (tbsa_adjusted > 0 AND tbsa_adjusted <= 100),
    ADD COLUMN IF NOT EXISTS tbsa_adjustment_reason TEXT;

-- Original GitHub tbsa_percent remains the
-- server-calculated value from the body map.

-- Staff members may adjust TBSA with a reason.
ALTER TABLE assessments
    ADD CONSTRAINT staff_tbsa_reason_required
    CHECK (
        tbsa_adjusted IS NULL
        OR (
            tbsa_adjustment_reason IS NOT NULL
            AND length(trim(tbsa_adjustment_reason)) >= 3
        )
    );
