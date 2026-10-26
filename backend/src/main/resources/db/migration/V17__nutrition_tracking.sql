-- Daily nutrition diary, immutable goal-plan history, and coach audit trail.
ALTER TABLE diet_plans ADD COLUMN water_ml_target int CHECK (water_ml_target >= 0);
ALTER TABLE diet_plans ADD COLUMN fiber_g_target int CHECK (fiber_g_target >= 0);

CREATE TABLE nutrition_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    gym_id uuid NOT NULL REFERENCES gyms(id),
    logged_on date NOT NULL,
    meal_type meal_type,
    food_name text NOT NULL,
    serving_amount numeric(9,2) NOT NULL CHECK (serving_amount > 0),
    serving_unit text NOT NULL,
    calories numeric(9,2) NOT NULL DEFAULT 0 CHECK (calories >= 0),
    protein_g numeric(9,2) NOT NULL DEFAULT 0 CHECK (protein_g >= 0),
    carbs_g numeric(9,2) NOT NULL DEFAULT 0 CHECK (carbs_g >= 0),
    fat_g numeric(9,2) NOT NULL DEFAULT 0 CHECK (fat_g >= 0),
    fiber_g numeric(9,2) NOT NULL DEFAULT 0 CHECK (fiber_g >= 0),
    water_ml int NOT NULL DEFAULT 0 CHECK (water_ml >= 0),
    source text NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL','USDA')),
    source_ref text,
    notes text,
    created_by_user_id uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_nutrition_entries_user_day ON nutrition_entries (user_id, logged_on DESC);

ALTER TABLE nutrition_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY p_nutrition_entries ON nutrition_entries USING (
    user_id = NULLIF(current_setting('app.user_id', true), '')::uuid OR
    current_setting('app.is_super_admin', true)::boolean IS TRUE OR
    gym_id = NULLIF(current_setting('app.gym_id', true), '')::uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON nutrition_entries TO lb_app;
