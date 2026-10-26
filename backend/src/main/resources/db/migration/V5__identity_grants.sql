-- =============================================================================
-- V5 — Identity: role grants, sessions, consent, OTP audit.
--
-- Split from V2 because these tables reference gyms (V3) and locations (V4).
-- Implements LB-DATA-1.0 §4. This is the most consequential design in the
-- whole schema — see AuthContext.java and RlsContextAspect.java for how it is
-- carried into every request.
-- =============================================================================

CREATE TABLE role_grants (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Nullable: SUPER_ADMIN's authority is platform-wide, tied to no single
    -- gym (AuthContext.superAdmin() sets gymId = null on the application
    -- side; the schema has to permit exactly that and nothing else).
    gym_id              uuid REFERENCES gyms(id),
    role                role_type NOT NULL,
    is_gym_wide         boolean NOT NULL DEFAULT false,
    granted_by_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
    granted_at          timestamptz NOT NULL DEFAULT now(),
    revoked_at          timestamptz,
    revoked_reason      text
);

-- Every role except SUPER_ADMIN must be scoped to a real gym.
ALTER TABLE role_grants ADD CONSTRAINT ck_role_grants_gym_required
    CHECK (gym_id IS NOT NULL OR role = 'SUPER_ADMIN');

-- FR-AUTH-18: only GYM_OWNER and SUPER_ADMIN may hold gym-wide scope.
ALTER TABLE role_grants ADD CONSTRAINT ck_role_grants_gym_wide_role
    CHECK (NOT is_gym_wide OR role IN ('GYM_OWNER','SUPER_ADMIN'));

-- FR-AUTH-11: one LIVE grant of a given role per user per gym. Partial index,
-- not a plain UNIQUE constraint — revoked grants stay as history and must not
-- block a later re-grant of the same role. NULLS NOT DISTINCT matters here
-- specifically for SUPER_ADMIN, whose gym_id is NULL: Postgres's default is
-- to treat every NULL as distinct from every other NULL, which would let one
-- user accumulate two "live" SUPER_ADMIN grants past this constraint. NULLS
-- NOT DISTINCT (PG15+) closes exactly that gap.
CREATE UNIQUE INDEX uq_role_grants_live
    ON role_grants (user_id, gym_id, role) NULLS NOT DISTINCT WHERE revoked_at IS NULL;
CREATE INDEX idx_role_grants_user ON role_grants (user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_role_grants_gym  ON role_grants (gym_id)  WHERE revoked_at IS NULL;

-- A junction table rather than a location_ids uuid[] column (LB-DATA-1.0
-- Appendix A): an array cannot carry a foreign key, so REFERENCES locations(id)
-- is what stops this from ever pointing at a deleted location.
CREATE TABLE role_grant_locations (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role_grant_id  uuid NOT NULL REFERENCES role_grants(id) ON DELETE CASCADE,
    location_id    uuid NOT NULL REFERENCES locations(id),
    CONSTRAINT uq_role_grant_locations UNIQUE (role_grant_id, location_id)
);
CREATE INDEX idx_role_grant_locations_location ON role_grant_locations (location_id);

CREATE TABLE refresh_tokens (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   text NOT NULL UNIQUE,
    device_label text,
    issued_at    timestamptz NOT NULL DEFAULT now(),
    expires_at   timestamptz NOT NULL,
    revoked_at   timestamptz
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id) WHERE revoked_at IS NULL;

-- NFR-PRV-06: MARKETING/WHATSAPP consent held separately from TERMS/PRIVACY.
-- Never deleted — consent history is a DPDP obligation.
CREATE TABLE user_consents (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type consent_type NOT NULL,
    version      text NOT NULL,
    granted_at   timestamptz NOT NULL DEFAULT now(),
    withdrawn_at timestamptz
);
CREATE INDEX idx_user_consents_user ON user_consents (user_id);

-- The audit trail for OTP issuance/verification. The THROTTLING decision
-- (FR-AUTH-12) is made by an in-memory limiter on the hot path; this table is
-- for abuse investigation, not queried per-request.
CREATE TABLE otp_attempts (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier          text NOT NULL,
    channel             text NOT NULL,
    device_fingerprint  text,
    kind                text NOT NULL,     -- REQUEST | VERIFY
    was_successful      boolean NOT NULL,
    attempted_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_otp_attempts_identifier ON otp_attempts (identifier, attempted_at DESC);

-- =============================================================================
-- Row-Level Security.
-- =============================================================================

ALTER TABLE role_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_grants FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_role_grants_isolation ON role_grants USING (
    current_setting('app.is_super_admin', true)::boolean IS TRUE
    OR user_id = NULLIF(current_setting('app.user_id', true), '')::uuid   -- your own grants
    OR gym_id  = NULLIF(current_setting('app.gym_id',  true), '')::uuid   -- or your gym's, if admin
);

ALTER TABLE role_grant_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_grant_locations FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_role_grant_locations_isolation ON role_grant_locations USING (
    current_setting('app.is_super_admin', true)::boolean IS TRUE
    OR EXISTS (
        SELECT 1 FROM role_grants rg WHERE rg.id = role_grant_locations.role_grant_id
          AND (rg.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
               OR rg.gym_id = NULLIF(current_setting('app.gym_id', true), '')::uuid)
    )
);

ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_refresh_tokens_isolation ON refresh_tokens USING (
    user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
);

ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_consents FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_user_consents_isolation ON user_consents USING (
    user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
);

-- otp_attempts: exempt, like job_queue — written pre-authentication (nobody
-- has an app.user_id yet when requesting an OTP), mediated by the service
-- layer alone.

GRANT SELECT, INSERT, UPDATE, DELETE ON
    role_grants, role_grant_locations, refresh_tokens, user_consents, otp_attempts
    TO lb_app;
