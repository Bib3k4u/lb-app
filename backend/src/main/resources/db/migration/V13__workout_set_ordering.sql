-- Workout sets were embedded and ordered in the reference application. Keep
-- that behavior explicitly in PostgreSQL rather than relying on row order.
ALTER TABLE workout_log_sets ADD COLUMN position int;

WITH ordered AS (
    SELECT id,
           row_number() OVER (
               PARTITION BY workout_log_id
               ORDER BY exercise_id, set_number, id
           ) AS position
    FROM workout_log_sets
)
UPDATE workout_log_sets target
SET position = ordered.position
FROM ordered
WHERE target.id = ordered.id;

ALTER TABLE workout_log_sets ALTER COLUMN position SET NOT NULL;
ALTER TABLE workout_log_sets ADD CONSTRAINT uq_workout_set_position UNIQUE (workout_log_id, position);
