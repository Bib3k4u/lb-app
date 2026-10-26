-- Phase 2 coaching vertical slice: assignment, workouts, progress, diets, feedback.

CREATE TABLE trainer_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    member_user_id uuid NOT NULL REFERENCES users(id),
    trainer_user_id uuid NOT NULL REFERENCES users(id),
    gym_id uuid NOT NULL REFERENCES gyms(id),
    location_id uuid NOT NULL REFERENCES locations(id),
    assigned_by_user_id uuid NOT NULL REFERENCES users(id),
    assigned_at timestamptz NOT NULL DEFAULT now(),
    ended_at timestamptz,
    CONSTRAINT ck_trainer_assignment_not_self CHECK (member_user_id <> trainer_user_id)
);
CREATE UNIQUE INDEX uq_trainer_assignments_live ON trainer_assignments (member_user_id, gym_id) WHERE ended_at IS NULL;

CREATE TABLE exercises (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id uuid REFERENCES gyms(id),
    name text NOT NULL,
    discipline discipline NOT NULL,
    difficulty experience_level NOT NULL,
    instructions text NOT NULL,
    created_by_user_id uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO exercises (name, discipline, difficulty, instructions) VALUES
 ('Barbell Back Squat', 'STRENGTH', 'INTERMEDIATE', 'Brace your core, descend under control, and drive through the whole foot.'),
 ('Bench Press', 'STRENGTH', 'INTERMEDIATE', 'Keep shoulder blades set, lower to mid-chest, and press with control.'),
 ('Deadlift', 'STRENGTH', 'INTERMEDIATE', 'Brace, keep the bar close, and stand tall without leaning back.'),
 ('Push-up', 'STRENGTH', 'BEGINNER', 'Keep a straight body line and lower the chest under control.'),
 ('Walking Lunge', 'FUNCTIONAL', 'BEGINNER', 'Step long, lower the rear knee, and keep the front knee tracking over toes.'),
 ('Plank', 'FUNCTIONAL', 'BEGINNER', 'Brace the trunk and maintain a neutral spine.'),
 ('Treadmill Run', 'CARDIO', 'BEGINNER', 'Use a sustainable pace and relaxed stride.'),
 ('Sun Salutation', 'YOGA', 'BEGINNER', 'Move with the breath through the complete sequence.');

CREATE TABLE workout_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    gym_id uuid REFERENCES gyms(id),
    location_id uuid REFERENCES locations(id),
    title text NOT NULL,
    performed_at timestamptz NOT NULL,
    duration_minutes int NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 1440),
    notes text,
    idempotency_key text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_workout_log_idempotency UNIQUE (user_id, idempotency_key)
);

CREATE TABLE workout_log_sets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_log_id uuid NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
    exercise_id uuid NOT NULL REFERENCES exercises(id),
    set_number int NOT NULL CHECK (set_number > 0),
    reps int CHECK (reps >= 0),
    weight_kg numeric(7,2) CHECK (weight_kg >= 0),
    seconds int CHECK (seconds >= 0),
    rpe numeric(3,1) CHECK (rpe >= 0 AND rpe <= 10),
    CONSTRAINT uq_workout_set_number UNIQUE (workout_log_id, exercise_id, set_number)
);

CREATE TABLE body_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    gym_id uuid REFERENCES gyms(id),
    metric_type metric_type NOT NULL,
    recorded_on date NOT NULL,
    value numeric(7,2) NOT NULL CHECK (value > 0 AND value < 1000),
    unit text NOT NULL,
    recorded_by_user_id uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_body_metrics_daily UNIQUE (user_id, metric_type, recorded_on)
);

CREATE TABLE diet_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    gym_id uuid NOT NULL REFERENCES gyms(id),
    author_user_id uuid NOT NULL REFERENCES users(id),
    objective text NOT NULL,
    content text NOT NULL,
    kcal_target int CHECK (kcal_target > 0),
    protein_g int CHECK (protein_g >= 0),
    carbs_g int CHECK (carbs_g >= 0),
    fat_g int CHECK (fat_g >= 0),
    starts_on date NOT NULL,
    ends_on date,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_diet_plan_active ON diet_plans (user_id, gym_id) WHERE active;

CREATE TABLE feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id uuid NOT NULL REFERENCES gyms(id),
    location_id uuid NOT NULL REFERENCES locations(id),
    author_user_id uuid NOT NULL REFERENCES users(id),
    category feedback_category NOT NULL,
    body text NOT NULL,
    state text NOT NULL DEFAULT 'OPEN' CHECK (state IN ('OPEN','IN_REVIEW','RESOLVED','CLOSED')),
    is_anonymous boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE feedback_responses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id uuid NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
    author_user_id uuid NOT NULL REFERENCES users(id),
    body text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trainer_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_assignments FORCE ROW LEVEL SECURITY;
CREATE POLICY p_trainer_assignments ON trainer_assignments USING (
  current_setting('app.is_super_admin', true)::boolean IS TRUE OR
  member_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid OR
  trainer_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid OR
  (gym_id = NULLIF(current_setting('app.gym_id', true), '')::uuid AND
   (current_setting('app.gym_wide', true)::boolean IS TRUE OR location_id = ANY(string_to_array(NULLIF(current_setting('app.location_ids', true), ''), ',')::uuid[])))
);

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises FORCE ROW LEVEL SECURITY;
CREATE POLICY p_exercises ON exercises USING (gym_id IS NULL OR gym_id = NULLIF(current_setting('app.gym_id', true), '')::uuid OR current_setting('app.is_super_admin', true)::boolean IS TRUE);

ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY p_workout_logs ON workout_logs USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid OR current_setting('app.is_super_admin', true)::boolean IS TRUE OR gym_id = NULLIF(current_setting('app.gym_id', true), '')::uuid);
ALTER TABLE workout_log_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_log_sets FORCE ROW LEVEL SECURITY;
CREATE POLICY p_workout_log_sets ON workout_log_sets USING (EXISTS (SELECT 1 FROM workout_logs w WHERE w.id = workout_log_sets.workout_log_id));

ALTER TABLE body_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_metrics FORCE ROW LEVEL SECURITY;
CREATE POLICY p_body_metrics ON body_metrics USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid OR current_setting('app.is_super_admin', true)::boolean IS TRUE OR gym_id = NULLIF(current_setting('app.gym_id', true), '')::uuid);

ALTER TABLE diet_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE diet_plans FORCE ROW LEVEL SECURITY;
CREATE POLICY p_diet_plans ON diet_plans USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid OR current_setting('app.is_super_admin', true)::boolean IS TRUE OR gym_id = NULLIF(current_setting('app.gym_id', true), '')::uuid);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback FORCE ROW LEVEL SECURITY;
CREATE POLICY p_feedback ON feedback USING (author_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid OR current_setting('app.is_super_admin', true)::boolean IS TRUE OR (gym_id = NULLIF(current_setting('app.gym_id', true), '')::uuid AND (current_setting('app.gym_wide', true)::boolean IS TRUE OR location_id = ANY(string_to_array(NULLIF(current_setting('app.location_ids', true), ''), ',')::uuid[]))));
ALTER TABLE feedback_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_responses FORCE ROW LEVEL SECURITY;
CREATE POLICY p_feedback_responses ON feedback_responses USING (EXISTS (SELECT 1 FROM feedback f WHERE f.id = feedback_responses.feedback_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON trainer_assignments, exercises, workout_logs, workout_log_sets, body_metrics, diet_plans, feedback, feedback_responses TO lb_app;
