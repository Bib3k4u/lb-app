CREATE TYPE location_state AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

ALTER TABLE locations
    ADD COLUMN approval_state location_state NOT NULL DEFAULT 'APPROVED',
    ADD COLUMN reviewed_at timestamptz,
    ADD COLUMN reviewed_by_user_id uuid REFERENCES users(id),
    ADD COLUMN rejection_reason text;

CREATE INDEX idx_locations_review_queue ON locations (approval_state, created_at);
