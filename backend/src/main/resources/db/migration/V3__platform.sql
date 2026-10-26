-- =============================================================================
-- V3 — Platform: gyms, subscription offerings, the subscription lifecycle.
--
-- Implements LB-DATA-1.0 §3 / LB-SRS-1.1 M20. Verification and activation are
-- deliberately separate steps (FR-SUB-03): a gym can be a legitimate business
-- (verified) and still not be entitled to operate because its subscription
-- has not been paid (not live).
-- =============================================================================

-- gyms: the tenant root. No gym_id column of its own — it IS the tenant.
CREATE TABLE gyms (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug              citext NOT NULL UNIQUE,
    legal_name        text NOT NULL,
    trading_name      text,
    gstin             text,
    state             gym_state NOT NULL DEFAULT 'PENDING_VERIFICATION',
    timezone          text NOT NULL DEFAULT 'Asia/Kolkata',
    currency          varchar(3) NOT NULL DEFAULT 'INR',
    logo_media_id     uuid REFERENCES media_assets(id),
    is_publicly_listed boolean NOT NULL DEFAULT false,
    -- FR-AUTH-16: the registrant becomes Gym Owner ON ACTIVATION, not at
    -- registration — so the system needs to remember who that is between
    -- the two events. No role_grant exists for them until activation runs.
    registered_by_user_id uuid NOT NULL REFERENCES users(id),
    verified_at       timestamptz,
    verified_by_user_id uuid REFERENCES users(id),   -- users exists from V2
    rejected_reason   text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE subscription_offerings (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name          text NOT NULL,
    term_months   int NOT NULL CHECK (term_months > 0),
    price_minor   bigint NOT NULL CHECK (price_minor >= 0),
    currency      varchar(3) NOT NULL DEFAULT 'INR',
    max_locations int,
    max_members   int,
    is_active     boolean NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE gym_subscriptions (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id         uuid NOT NULL REFERENCES gyms(id),
    offering_id    uuid NOT NULL REFERENCES subscription_offerings(id),
    starts_on      date NOT NULL,
    expires_on     date NOT NULL,
    grace_until_on date NOT NULL,
    state          subscription_state NOT NULL DEFAULT 'LIVE',
    created_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_gym_subscriptions_dates CHECK (expires_on >= starts_on AND grace_until_on >= expires_on)
);

-- FR-SUB-04: a gym has at most one LIVE subscription at any time.
CREATE UNIQUE INDEX uq_gym_subscriptions_live
    ON gym_subscriptions (gym_id) WHERE state = 'LIVE';
CREATE INDEX idx_gym_subscriptions_gym ON gym_subscriptions (gym_id);
-- Nightly SubscriptionSweep scans for expiring/lapsed terms (FR-SUB-06).
CREATE INDEX idx_gym_subscriptions_expiry ON gym_subscriptions (expires_on) WHERE state = 'LIVE';

-- subscription_payments: cash the Super Admin recorded. Append-only (DM-04) —
-- never updated or deleted. recorded_by_user_id references users, created in
-- V2, so this ordering is safe.
CREATE TABLE subscription_payments (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id     uuid NOT NULL REFERENCES gym_subscriptions(id),
    gym_id              uuid NOT NULL REFERENCES gyms(id),
    amount_minor        bigint NOT NULL CHECK (amount_minor > 0),
    currency            varchar(3) NOT NULL DEFAULT 'INR',
    method              payment_method NOT NULL,
    reference           text,
    received_on         date NOT NULL,
    recorded_by_user_id uuid NOT NULL REFERENCES users(id),
    idempotency_key     text NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_subscription_payments_idempotency UNIQUE (recorded_by_user_id, idempotency_key)
);
CREATE INDEX idx_subscription_payments_gym ON subscription_payments (gym_id, received_on DESC);

-- =============================================================================
-- Row-Level Security.
-- =============================================================================

-- gyms: readable by anyone who can already resolve it (own gym for regular
-- users; every gym for the Super Admin) PLUS anything the gym has opted into
-- publishing. Writes are gated at the service layer by role (FR-ORG-12),
-- since "may this caller edit gym X" depends on role_grants, which do not
-- exist until V5 and cannot be referenced by a policy defined here without a
-- forward dependency.
--
-- The is_publicly_listed clause is load-bearing, not optional: RLS is FORCED,
-- so an unauthenticated public-directory request (no app.gym_id set at all)
-- would otherwise match zero rows and the directory would render empty. A
-- gym that opted into listing is meant to be visible to anyone, which is
-- exactly what this clause says — it is not a workaround, it is the policy.
ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyms FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_gyms_isolation ON gyms USING (
    current_setting('app.is_super_admin', true)::boolean IS TRUE
    OR id = NULLIF(current_setting('app.gym_id', true), '')::uuid
    OR is_publicly_listed = true
);

ALTER TABLE subscription_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_offerings FORCE ROW LEVEL SECURITY;
CREATE POLICY p_subscription_offerings_isolation ON subscription_offerings USING (true);
-- Platform-wide catalogue, deliberately world-readable to any authenticated
-- caller (a gym owner must be able to see what they can subscribe to); writes
-- are Super-Admin-only, enforced in the service layer.

ALTER TABLE gym_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY p_gym_subscriptions_isolation ON gym_subscriptions USING (
    current_setting('app.is_super_admin', true)::boolean IS TRUE
    OR gym_id = NULLIF(current_setting('app.gym_id', true), '')::uuid
);

ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments FORCE ROW LEVEL SECURITY;
CREATE POLICY p_subscription_payments_isolation ON subscription_payments USING (
    current_setting('app.is_super_admin', true)::boolean IS TRUE
    OR gym_id = NULLIF(current_setting('app.gym_id', true), '')::uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON
    gyms, subscription_offerings, gym_subscriptions, subscription_payments
    TO lb_app;
