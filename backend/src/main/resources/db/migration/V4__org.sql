-- =============================================================================
-- V4 — Org: locations, hours, closures.
--
-- Implements LB-DATA-1.0 §3 (locations). A location is a hard isolation
-- boundary (CON-09) — every operational table below this point carries both
-- gym_id and location_id.
-- =============================================================================

CREATE TABLE locations (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id            uuid NOT NULL REFERENCES gyms(id),
    slug              citext NOT NULL,
    name              text NOT NULL,
    address_line1     text NOT NULL,
    address_line2     text,
    city              text NOT NULL,
    state             text NOT NULL,
    pincode           text NOT NULL,
    latitude          double precision NOT NULL,
    longitude         double precision NOT NULL,
    -- Generated PostGIS geography column, kept in step with latitude/longitude
    -- automatically. JPA maps only the plain doubles above (no hibernate-spatial
    -- dependency needed for that); this column exists for two things Postgres
    -- does far better than application code: ST_Distance for geofence checks
    -- (used from a native query in AttendanceService) and, later, "gyms near
    -- me" proximity search for the public directory (LB-DATA-1.0 §13.3).
    geo               geography(Point,4326) GENERATED ALWAYS AS (
                          ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
                      ) STORED,
    checkin_radius_m  int NOT NULL DEFAULT 100,
    phone_e164        text,
    floor_capacity    int,
    is_publicly_listed boolean NOT NULL DEFAULT false,
    meta_title        text,
    meta_description  text,
    closed_at         timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_locations_gym_slug UNIQUE (gym_id, slug),
    -- FR-ATT-02: a 5km "geofence" defeats the point of geofencing.
    CONSTRAINT ck_locations_radius CHECK (checkin_radius_m BETWEEN 20 AND 500)
);
CREATE INDEX idx_locations_gym ON locations (gym_id);
CREATE INDEX idx_locations_geo ON locations USING GIST (geo);

CREATE TABLE location_hours (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    opens_at    time,
    closes_at   time,
    is_closed   boolean NOT NULL DEFAULT false,
    CONSTRAINT uq_location_hours UNIQUE (location_id, day_of_week)
);

CREATE TABLE location_closures (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    closed_on   date NOT NULL,
    reason      text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_location_closures UNIQUE (location_id, closed_on)
);

-- =============================================================================
-- Row-Level Security — shape A (gym + location), per LB-DATA-1.0 §16.
-- =============================================================================

-- Same reasoning as p_gyms_isolation (V3): is_publicly_listed is load-bearing
-- because RLS is FORCED, and an anonymous directory request has no
-- app.gym_id to match against at all.
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_locations_isolation ON locations USING (
    current_setting('app.is_super_admin', true)::boolean IS TRUE
    OR gym_id = NULLIF(current_setting('app.gym_id', true), '')::uuid
    OR is_publicly_listed = true
);

ALTER TABLE location_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_hours FORCE ROW LEVEL SECURITY;
CREATE POLICY p_location_hours_isolation ON location_hours USING (
    current_setting('app.is_super_admin', true)::boolean IS TRUE
    OR EXISTS (SELECT 1 FROM locations l WHERE l.id = location_hours.location_id
               AND l.gym_id = NULLIF(current_setting('app.gym_id', true), '')::uuid)
);

ALTER TABLE location_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_closures FORCE ROW LEVEL SECURITY;
CREATE POLICY p_location_closures_isolation ON location_closures USING (
    current_setting('app.is_super_admin', true)::boolean IS TRUE
    OR EXISTS (SELECT 1 FROM locations l WHERE l.id = location_closures.location_id
               AND l.gym_id = NULLIF(current_setting('app.gym_id', true), '')::uuid)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON locations, location_hours, location_closures TO lb_app;
