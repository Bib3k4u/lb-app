-- =============================================================================
-- V2 — Identity core: users and the universal fitness profile.
--
-- Split from role_grants (which needs gyms + locations, created in V3/V4) to
-- avoid a forward reference. Implements LB-DATA-1.0 §4/§5.
-- =============================================================================

-- users: no gym_id. Authority is a grant (role_grants, V5), never a column
-- here — this is the schema expression of "membership is a role, not an
-- identity" (LB-DATA-1.0 §2.1), and it is what lets staff train without a
-- second account.
CREATE TABLE users (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_e164         text UNIQUE,
    email              citext UNIQUE,
    password_hash      text,
    first_name         text NOT NULL,
    last_name          text NOT NULL,
    date_of_birth      date,
    gender             text,
    avatar_media_id    uuid REFERENCES media_assets(id),
    state              account_state NOT NULL DEFAULT 'PENDING_VERIFICATION',
    phone_verified_at  timestamptz,
    email_verified_at  timestamptz,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    deleted_at         timestamptz,
    CONSTRAINT ck_users_has_identifier CHECK (phone_e164 IS NOT NULL OR email IS NOT NULL)
);

-- FR-PFP-01: every account owns a personal fitness profile, unconditionally.
-- 1:1 with users, created in the SAME transaction as the user — never later,
-- so no code path can ever observe a user without one.
CREATE TABLE fitness_profiles (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    height_cm         numeric(5,1),
    -- Plain text, not the experience_level enum type: FitnessProfile's Java
    -- side deliberately keeps this an untyped String (see the entity's own
    -- doc comment — no method branches on it), so the column stays as loose
    -- as the code that reads it rather than adding a closed vocabulary
    -- nothing enforces yet.
    experience_level  text,
    primary_goal      text,
    preferred_times   jsonb,
    dietary_pref      dietary_preference,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Both tables are deliberately exempt from RLS (LB-DATA-1.0 §16): a person may
-- belong to several gyms, so tenancy scoping happens through role_grants and
-- member_records, not here. Self-scoping ("my own profile") is enforced at
-- the service layer via auth.userId(), which these tables have no column to
-- express as a database policy anyway.

GRANT SELECT, INSERT, UPDATE, DELETE ON users, fitness_profiles TO lb_app;
