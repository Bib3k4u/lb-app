-- Preserve the reference application's complete workout and feedback object
-- shapes while keeping PostgreSQL tenancy and location scope.

ALTER TABLE workout_logs ADD COLUMN description text;
ALTER TABLE workout_logs ADD COLUMN trainer_user_id uuid REFERENCES users(id);
ALTER TABLE workout_logs ADD COLUMN target_muscle_groups text[] NOT NULL DEFAULT '{}';

ALTER TABLE workout_log_sets ADD COLUMN notes text;
ALTER TABLE workout_log_sets ADD COLUMN volume numeric(12,2)
    GENERATED ALWAYS AS (COALESCE(reps, 0) * COALESCE(weight_kg, 0)) STORED;

ALTER TABLE feedback ADD COLUMN title text;
UPDATE feedback SET title = initcap(replace(category::text, '_', ' ')) || ' feedback';
ALTER TABLE feedback ALTER COLUMN title SET NOT NULL;
ALTER TABLE feedback ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE feedback_responses ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX idx_workout_logs_user_status ON workout_logs(user_id, status, performed_at DESC);
CREATE INDEX idx_workout_logs_targets ON workout_logs USING gin(target_muscle_groups);
