-- The application code now flips is_publicly_listed on the LIVE/APPROVED
-- transitions themselves (Gym.goLive/reactivate, Location.review), but that
-- only takes effect going forward. Backfill rows that reached those states
-- before this was wired up, so the public directory isn't missing them.
UPDATE gyms SET is_publicly_listed = true WHERE state = 'LIVE';
UPDATE locations SET is_publicly_listed = true WHERE approval_state = 'APPROVED' AND closed_at IS NULL;
