-- =============================================================================
-- V8 — Attendance: check-ins, rotating QR secrets, derived streaks.
--
-- Implements LB-DATA-1.0 §7. Small domain, high write volume, and the one
-- most exposed to offline replay — its correctness rests entirely on the
-- idempotency constraint below.
-- =============================================================================

CREATE TABLE check_ins (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id              uuid NOT NULL REFERENCES gyms(id),
    location_id         uuid NOT NULL REFERENCES locations(id),
    user_id             uuid NOT NULL REFERENCES users(id),
    occurred_at         timestamptz NOT NULL,
    checked_out_at      timestamptz,
    method              checkin_method NOT NULL,
    purpose             checkin_purpose NOT NULL,
    recorded_by_user_id uuid REFERENCES users(id),   -- set only when staff mark it manually
    is_deferred         boolean NOT NULL DEFAULT false,
    distance_m          double precision,
    is_flagged          boolean NOT NULL DEFAULT false,
    idempotency_key     text NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    -- FR-ATT-05 / ADR-06: the single constraint that makes offline replay
    -- safe. The client reuses one key across every retry, so a duplicate
    -- submission collides here and the service returns the original row
    -- instead of inserting a second one.
    CONSTRAINT uq_check_ins_idempotency UNIQUE (user_id, idempotency_key)
);

CREATE INDEX idx_check_ins_user_occurred     ON check_ins (user_id, occurred_at DESC);
CREATE INDEX idx_check_ins_location_occurred ON check_ins (gym_id, location_id, occurred_at DESC);

CREATE TABLE location_qr_secrets (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id  uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    secret       bytea NOT NULL,
    rotation_seconds int NOT NULL DEFAULT 30,
    rotated_at   timestamptz NOT NULL DEFAULT now(),
    is_active    boolean NOT NULL DEFAULT true
);
CREATE INDEX idx_location_qr_secrets_active ON location_qr_secrets (location_id) WHERE is_active;

CREATE TABLE attendance_streaks (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid NOT NULL REFERENCES users(id),
    gym_id            uuid NOT NULL REFERENCES gyms(id),
    current_streak    int NOT NULL DEFAULT 0,
    longest_streak    int NOT NULL DEFAULT 0,
    last_check_in_on  date,
    habitual_hour     int,
    updated_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_attendance_streaks_user_gym UNIQUE (user_id, gym_id)
);

-- =============================================================================
-- Row-Level Security — shape A.
-- =============================================================================

ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_check_ins_isolation ON check_ins USING (
    current_setting('app.is_super_admin', true)::boolean IS TRUE
    OR user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    OR (
        gym_id = NULLIF(current_setting('app.gym_id', true), '')::uuid
        AND (
            current_setting('app.gym_wide', true)::boolean IS TRUE
            OR location_id = ANY(string_to_array(
                 NULLIF(current_setting('app.location_ids', true), ''), ',')::uuid[])
        )
    )
);

ALTER TABLE location_qr_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_qr_secrets FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_location_qr_secrets_isolation ON location_qr_secrets USING (
    current_setting('app.is_super_admin', true)::boolean IS TRUE
    OR EXISTS (SELECT 1 FROM locations l WHERE l.id = location_qr_secrets.location_id
               AND l.gym_id = NULLIF(current_setting('app.gym_id', true), '')::uuid)
);

ALTER TABLE attendance_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_streaks FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_attendance_streaks_isolation ON attendance_streaks USING (
    current_setting('app.is_super_admin', true)::boolean IS TRUE
    OR user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    OR gym_id  = NULLIF(current_setting('app.gym_id',  true), '')::uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON check_ins, location_qr_secrets, attendance_streaks TO lb_app;
