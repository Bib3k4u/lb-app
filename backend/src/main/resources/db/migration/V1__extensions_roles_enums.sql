-- =============================================================================
-- V1 — Extensions, database roles, and the enum catalogue.
--
-- Implements LB-DATA-1.0 §18 (V1) and §19.
--
-- Run as lb_migrator, which OWNS the schema. The application connects as
-- lb_app, which owns nothing. This separation is NN-2 and it is not optional:
-- a table owner bypasses RLS policies by default, so an application connecting
-- as the owner would have every policy silently inert while appearing to work.
-- =============================================================================

-- --- Extensions --------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;      -- case-insensitive slugs and emails
CREATE EXTENSION IF NOT EXISTS postgis;     -- geofencing + "gyms near me" (§3)
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- trainer overlap exclusion (§8)

-- --- Application role ---------------------------------------------------------
-- Created only if absent so this migration is safe to re-run against an
-- environment where infrastructure provisioned the role already.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lb_app') THEN
        CREATE ROLE lb_app LOGIN;
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO lb_app;

-- lb_app gets DML on current and future tables, and never DDL or ownership.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lb_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO lb_app;

-- --- Enum catalogue (LB-DATA-1.0 §19) ----------------------------------------
-- Postgres enum types rather than free strings: adding a value is a migration,
-- which is correct. A new booking state should be a deliberate schema decision,
-- not a typo somebody inserted (DM-08).

CREATE TYPE gym_state AS ENUM (
    'PENDING_VERIFICATION', 'VERIFIED', 'LIVE', 'LAPSED', 'SUSPENDED', 'CLOSED');

CREATE TYPE subscription_state AS ENUM (
    'PENDING', 'LIVE', 'GRACE', 'LAPSED', 'CANCELLED');

CREATE TYPE account_state AS ENUM (
    'PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');

CREATE TYPE role_type AS ENUM (
    'SUPER_ADMIN', 'GYM_OWNER', 'LOCATION_ADMIN', 'TRAINER', 'MEMBER');

CREATE TYPE membership_state AS ENUM (
    'PENDING', 'ACTIVE', 'FROZEN', 'EXPIRED', 'CANCELLED');

CREATE TYPE payment_method AS ENUM (
    'CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE');

CREATE TYPE checkin_method AS ENUM ('QR', 'GEOFENCE', 'MANUAL');

-- FR-ATT-13: without this, a trainer's own workout inflates both trainer
-- utilisation and member footfall, and every operational figure drifts.
CREATE TYPE checkin_purpose AS ENUM ('SHIFT', 'PERSONAL_WORKOUT', 'BOTH');

CREATE TYPE session_state AS ENUM (
    'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TYPE booking_state AS ENUM (
    'BOOKED', 'WAITLISTED', 'CANCELLED', 'ATTENDED', 'NO_SHOW');

CREATE TYPE appointment_state AS ENUM (
    'SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

CREATE TYPE delivery_mode AS ENUM ('ON_SITE', 'ONLINE', 'HYBRID');

CREATE TYPE credit_reason AS ENUM (
    'PURCHASE', 'SESSION_COMPLETED', 'LATE_CANCEL', 'EXPIRY', 'ADJUSTMENT', 'REFUND');

CREATE TYPE metric_type AS ENUM (
    'WEIGHT_KG', 'BODY_FAT_PCT', 'CHEST_CM', 'WAIST_CM',
    'HIP_CM', 'ARM_CM', 'THIGH_CM', 'NECK_CM');

CREATE TYPE record_type AS ENUM ('MAX_WEIGHT', 'MAX_REPS', 'MAX_VOLUME', 'BEST_TIME');

CREATE TYPE experience_level AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

CREATE TYPE discipline AS ENUM (
    'STRENGTH', 'CARDIO', 'FUNCTIONAL', 'YOGA', 'MOBILITY', 'MEDITATION', 'DANCE');

CREATE TYPE meal_type AS ENUM (
    'BREAKFAST', 'MID_MORNING', 'LUNCH', 'SNACK', 'DINNER', 'POST_WORKOUT');

CREATE TYPE dietary_preference AS ENUM (
    'VEGETARIAN', 'VEGAN', 'EGGETARIAN', 'NON_VEGETARIAN', 'JAIN');

CREATE TYPE feedback_category AS ENUM (
    'FACILITY', 'EQUIPMENT', 'TRAINER', 'CLEANLINESS', 'BILLING', 'APPLICATION', 'OTHER');

CREATE TYPE lead_state AS ENUM (
    'NEW', 'CONTACTED', 'TRIAL_BOOKED', 'TRIAL_ATTENDED', 'CONVERTED', 'LOST');

CREATE TYPE lead_source AS ENUM (
    'LOCATION_PAGE', 'GYM_PAGE', 'CLASS_PAGE', 'BLOG', 'DIRECT', 'REFERRAL');

CREATE TYPE job_state AS ENUM ('PENDING', 'CLAIMED', 'SUCCEEDED', 'FAILED', 'DEAD');

CREATE TYPE ai_feature AS ENUM (
    'WORKOUT_PROGRESSION', 'DIET_DRAFT', 'PROGRESS_NARRATIVE', 'CHURN_RISK');

-- NFR-PRV-06: marketing and WhatsApp consent are held SEPARATELY from the
-- consent to operate the service. Two enum values is the cheapest possible way
-- to make conflating them impossible.
CREATE TYPE consent_type AS ENUM ('TERMS', 'PRIVACY', 'MARKETING', 'WHATSAPP');

CREATE TYPE media_sensitivity AS ENUM ('PUBLIC', 'SENSITIVE');

-- --- Cross-cutting tables (LB-DATA-1.0 §14) ----------------------------------

-- NN-4 lives here: there is NO url column, in this table or anywhere else.
-- Every media reference is a foreign key to this row and every URL is built at
-- read time from public_id. Because there is nowhere to put a full Cloudinary
-- URL, the rule cannot be broken by forgetting it.
CREATE TABLE media_assets (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id             uuid,                              -- null = platform-wide asset
    public_id          text NOT NULL UNIQUE,              -- Cloudinary public_id, never a URL
    sensitivity        media_sensitivity NOT NULL,        -- drives signed vs public delivery
    delivery_type      text NOT NULL DEFAULT 'upload',    -- 'upload' | 'authenticated'
    content_type       text NOT NULL,
    bytes              bigint,
    width              int,
    height             int,
    uploaded_by_user_id uuid,
    created_at         timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_media_assets_sensitive_delivery
        CHECK (sensitivity = 'PUBLIC' OR delivery_type = 'authenticated')
);

-- ADR-09: the job queue. No Redis, no SQS — the database you already run is a
-- competent queue at this scale, and jobs enqueued in the same transaction as
-- the change that triggers them cannot be orphaned by a rollback.
CREATE TABLE job_queue (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type    text NOT NULL,
    payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
    state       job_state NOT NULL DEFAULT 'PENDING',
    priority    int NOT NULL DEFAULT 0,
    run_after   timestamptz NOT NULL DEFAULT now(),
    attempts    int NOT NULL DEFAULT 0,
    last_error  text,
    claimed_at  timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Partial index: pending rows are a tiny slice of the table, and this is what
-- makes SELECT ... FOR UPDATE SKIP LOCKED polling inexpensive.
CREATE INDEX idx_job_queue_claimable
    ON job_queue (priority DESC, run_after)
    WHERE state = 'PENDING';

-- Generic idempotency for endpoints without a natural key. check_ins,
-- workout_logs, bookings and leads carry their own; this serves the rest.
CREATE TABLE idempotency_records (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL,
    idempotency_key text NOT NULL,
    endpoint        text NOT NULL,
    response_status int NOT NULL,
    response_body   jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    expires_at      timestamptz NOT NULL DEFAULT now() + interval '24 hours',
    CONSTRAINT uq_idempotency_records UNIQUE (user_id, idempotency_key)
);

-- FR-ADM-02: append-only. Never updated, never deleted.
CREATE TABLE audit_log (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id        uuid,
    actor_user_id uuid,
    action        text NOT NULL,
    subject_type  text NOT NULL,
    subject_id    uuid,
    before        jsonb,
    after         jsonb,
    reason        text,
    occurred_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_subject ON audit_log (subject_type, subject_id, occurred_at DESC);
CREATE INDEX idx_audit_log_gym     ON audit_log (gym_id, occurred_at DESC);

-- --- RLS on cross-cutting tables ---------------------------------------------
-- LB-DATA-1.0 §16 lists job_queue and idempotency_records as deliberately
-- exempt (worker-only and self-scoped respectively). media_assets and audit_log
-- are gym-scoped, so they get policies now — every table gets its policy in the
-- SAME migration that creates it.

ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_media_assets_isolation ON media_assets USING (
    gym_id IS NULL                                                   -- platform assets
    OR current_setting('app.is_super_admin', true)::boolean IS TRUE
    OR gym_id = current_setting('app.gym_id', true)::uuid
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_audit_log_isolation ON audit_log USING (
    current_setting('app.is_super_admin', true)::boolean IS TRUE
    OR gym_id = current_setting('app.gym_id', true)::uuid
);

-- Grant DML on the tables created above (default privileges cover future ones).
GRANT SELECT, INSERT, UPDATE, DELETE
    ON media_assets, job_queue, idempotency_records, audit_log TO lb_app;
