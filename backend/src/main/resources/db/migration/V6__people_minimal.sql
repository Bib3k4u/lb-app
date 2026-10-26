-- =============================================================================
-- V6 — People: member records only.
--
-- Scoped deliberately narrow for this pass. LB-DATA-1.0 §5 also specifies
-- health_screenings, emergency_contacts, trainer_profiles/availability/shifts
-- and trainer_assignments — all real Phase 1/2 tables, but not required by
-- the vertical slice this migration set builds (auth, gym/location admin,
-- check-in). Deferred, not forgotten: see backend/DEV.md "What's built".
--
-- member_records is the minimum needed for FR-ATT-06 (a check-in must find an
-- active membership) and FR-BIL-16 (staff train without one).
-- =============================================================================

CREATE TABLE member_records (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES users(id),
    gym_id              uuid NOT NULL REFERENCES gyms(id),
    primary_location_id uuid NOT NULL REFERENCES locations(id),
    joined_on           date NOT NULL DEFAULT CURRENT_DATE,
    member_code         text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_member_records_user_gym UNIQUE (user_id, gym_id)
);
CREATE INDEX idx_member_records_gym_location ON member_records (gym_id, primary_location_id);

ALTER TABLE member_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_records FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_member_records_isolation ON member_records USING (
    current_setting('app.is_super_admin', true)::boolean IS TRUE
    OR user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    OR (
        gym_id = NULLIF(current_setting('app.gym_id', true), '')::uuid
        AND (
            current_setting('app.gym_wide', true)::boolean IS TRUE
            OR primary_location_id = ANY(string_to_array(
                 NULLIF(current_setting('app.location_ids', true), ''), ',')::uuid[])
        )
    )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON member_records TO lb_app;
