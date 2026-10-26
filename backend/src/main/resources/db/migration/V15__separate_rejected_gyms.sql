-- Before lifecycle management existed, SUSPENDED was used only for rejected
-- registrations. Preserve that meaning while freeing SUSPENDED for reversible
-- deactivation of an already-active gym.
UPDATE gyms
SET state = 'REJECTED'::gym_state
WHERE state = 'SUSPENDED'::gym_state;
