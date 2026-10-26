-- Initial locations were created APPROVED but never flagged is_publicly_listed
-- (Location.markInitialLocationApproved did not set it), so a LIVE gym's first
-- location stayed out of the public directory, which needs gym AND location
-- listed. Backfill them; new ones are flagged in code from now on.
UPDATE locations
SET is_publicly_listed = true
WHERE approval_state = 'APPROVED' AND closed_at IS NULL AND is_publicly_listed = false;
