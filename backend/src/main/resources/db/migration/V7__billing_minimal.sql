-- =============================================================================
-- V7 — Billing: plans and memberships only.
--
-- Scoped narrow, matching V6's note: full billing (payments, receipts, PT
-- packages, freezes, refunds — LB-DATA-1.0 §6) is Phase 1/2 work not required
-- by this pass. What check-in actually needs is: does this member hold an
-- ACTIVE, unexpired membership right now (FR-ATT-06)? These two tables answer
-- that and nothing more.
-- =============================================================================

CREATE TABLE plans (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id           uuid NOT NULL REFERENCES gyms(id),
    name             text NOT NULL,
    duration_months  int NOT NULL CHECK (duration_months > 0),
    price_minor      bigint NOT NULL CHECK (price_minor >= 0),
    currency         varchar(3) NOT NULL DEFAULT 'INR',
    includes_group_classes boolean NOT NULL DEFAULT false,
    is_active        boolean NOT NULL DEFAULT true,
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_plans_gym ON plans (gym_id) WHERE is_active;

CREATE TABLE memberships (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    member_record_id  uuid NOT NULL REFERENCES member_records(id),
    plan_id           uuid NOT NULL REFERENCES plans(id),
    starts_on         date NOT NULL,
    expires_on        date NOT NULL,
    price_agreed_minor bigint NOT NULL CHECK (price_agreed_minor >= 0),
    state             membership_state NOT NULL DEFAULT 'ACTIVE',
    created_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_memberships_dates CHECK (expires_on >= starts_on)
);

-- FR-BIL-02: at most one ACTIVE membership per member.
CREATE UNIQUE INDEX uq_memberships_active
    ON memberships (member_record_id) WHERE state = 'ACTIVE';
CREATE INDEX idx_memberships_member ON memberships (member_record_id);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_plans_isolation ON plans USING (
    current_setting('app.is_super_admin', true)::boolean IS TRUE
    OR gym_id = NULLIF(current_setting('app.gym_id', true), '')::uuid
);
-- Gym-wide (shape B): plans are pricing, reserved to the Gym Owner to write
-- (FR-ORG-12) but readable by any staff of the gym at any location.

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_memberships_isolation ON memberships USING (
    current_setting('app.is_super_admin', true)::boolean IS TRUE
    OR EXISTS (
        SELECT 1 FROM member_records mr WHERE mr.id = memberships.member_record_id
          AND (
              mr.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
              OR (
                  mr.gym_id = NULLIF(current_setting('app.gym_id', true), '')::uuid
                  AND (
                      current_setting('app.gym_wide', true)::boolean IS TRUE
                      OR mr.primary_location_id = ANY(string_to_array(
                           NULLIF(current_setting('app.location_ids', true), ''), ',')::uuid[])
                  )
              )
          )
    )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON plans, memberships TO lb_app;
