-- Rich exercise catalogue and planned workout lifecycle, aligned with the
-- proven training flow in limitbeyond2.0 while retaining this service's API.

ALTER TABLE exercises ADD COLUMN primary_muscle_group text;
ALTER TABLE exercises ADD COLUMN secondary_muscle_group text;
ALTER TABLE exercises ADD COLUMN requires_weight boolean NOT NULL DEFAULT true;

UPDATE exercises SET primary_muscle_group = CASE name
  WHEN 'Barbell Back Squat' THEN 'Quadriceps'
  WHEN 'Bench Press' THEN 'Chest'
  WHEN 'Deadlift' THEN 'Back'
  WHEN 'Push-up' THEN 'Chest'
  WHEN 'Walking Lunge' THEN 'Quadriceps'
  WHEN 'Plank' THEN 'Core'
  WHEN 'Treadmill Run' THEN 'Cardio'
  WHEN 'Sun Salutation' THEN 'Full Body'
  ELSE 'Full Body'
END;
UPDATE exercises SET requires_weight = false WHERE name IN ('Push-up', 'Plank', 'Treadmill Run', 'Sun Salutation');
ALTER TABLE exercises ALTER COLUMN primary_muscle_group SET NOT NULL;

ALTER TABLE workout_logs ADD COLUMN status text NOT NULL DEFAULT 'COMPLETED';
ALTER TABLE workout_logs ADD COLUMN completed_at timestamptz;
UPDATE workout_logs SET completed_at = performed_at WHERE status = 'COMPLETED';
ALTER TABLE workout_logs ADD CONSTRAINT ck_workout_status CHECK (status IN ('PLANNED', 'COMPLETED'));

ALTER TABLE workout_log_sets ADD COLUMN completed boolean NOT NULL DEFAULT false;
UPDATE workout_log_sets SET completed = true;

INSERT INTO exercises (name, discipline, difficulty, instructions, primary_muscle_group, secondary_muscle_group, requires_weight)
SELECT v.name, v.discipline::discipline, v.difficulty::experience_level, v.instructions, v.primary_group, v.secondary_group, v.requires_weight
FROM (VALUES
 ('Incline Bench Press','STRENGTH','INTERMEDIATE','Set the bench to a low incline, keep the shoulder blades set, and press with control.','Chest','Shoulders, Triceps',true),
 ('Overhead Press','STRENGTH','INTERMEDIATE','Brace the trunk and press overhead without leaning back.','Shoulders','Triceps',true),
 ('Lateral Raise','STRENGTH','BEGINNER','Raise the weights to shoulder height with soft elbows and controlled tempo.','Shoulders',NULL,true),
 ('Triceps Pushdown','STRENGTH','BEGINNER','Keep elbows pinned and extend fully without moving the shoulders.','Triceps',NULL,true),
 ('Barbell Row','STRENGTH','INTERMEDIATE','Hinge at the hips, brace, and pull the bar toward the lower ribs.','Back','Biceps',true),
 ('Pull-Up','STRENGTH','INTERMEDIATE','Start from a controlled hang and pull the chest toward the bar.','Back','Biceps',false),
 ('Barbell Curl','STRENGTH','BEGINNER','Keep elbows close and curl without swinging the torso.','Biceps','Forearms',true),
 ('Hammer Curl','STRENGTH','BEGINNER','Use a neutral grip and keep the upper arm still.','Biceps','Forearms',true),
 ('Squat','STRENGTH','BEGINNER','Brace, sit between the hips, and keep knees tracking over toes.','Quadriceps','Glutes, Hamstrings',true),
 ('Romanian Deadlift','STRENGTH','INTERMEDIATE','Push the hips back with a neutral spine and keep the weight close.','Hamstrings','Glutes, Back',true),
 ('Leg Press','STRENGTH','BEGINNER','Lower under control and drive through the whole foot.','Quadriceps','Glutes',true),
 ('Leg Curl','STRENGTH','BEGINNER','Curl through the full range without lifting the hips.','Hamstrings',NULL,true),
 ('Leg Extension','STRENGTH','BEGINNER','Extend smoothly and pause briefly at the top.','Quadriceps',NULL,true),
 ('Dumbbell Fly','STRENGTH','BEGINNER','Keep a soft elbow and lower until the chest is comfortably stretched.','Chest','Shoulders',true),
 ('Push-Up','STRENGTH','BEGINNER','Keep a straight body line and lower the chest under control.','Chest','Triceps, Shoulders',false),
 ('Arnold Press','STRENGTH','INTERMEDIATE','Rotate smoothly as you press while keeping the ribs down.','Shoulders','Triceps',true),
 ('Front Raise','STRENGTH','BEGINNER','Raise to shoulder height without using momentum.','Shoulders',NULL,true),
 ('Close-Grip Bench Press','STRENGTH','INTERMEDIATE','Use a comfortable close grip and keep elbows controlled.','Triceps','Chest',true),
 ('Lat Pulldown','STRENGTH','BEGINNER','Drive elbows down and pull the bar toward the upper chest.','Back','Biceps',true),
 ('Face Pull','STRENGTH','BEGINNER','Pull toward eye level and externally rotate at the finish.','Shoulders','Back',true),
 ('Dumbbell Curl','STRENGTH','BEGINNER','Curl with a stable upper arm and controlled lowering.','Biceps',NULL,true),
 ('Preacher Curl','STRENGTH','INTERMEDIATE','Keep the upper arm supported and avoid locking the elbow.','Biceps',NULL,true),
 ('Dips','STRENGTH','INTERMEDIATE','Lower with control and press to a strong supported position.','Triceps','Chest, Shoulders',false),
 ('Rows','STRENGTH','BEGINNER','Brace the torso and draw the elbows behind the body.','Back','Biceps',true),
 ('Superman','FUNCTIONAL','BEGINNER','Lift opposite limbs gently while keeping the neck neutral.','Back','Glutes',false),
 ('Squats','STRENGTH','BEGINNER','Sit down between the hips and stand through the whole foot.','Quadriceps','Glutes',false),
 ('Lunges','FUNCTIONAL','BEGINNER','Step with control and keep the front knee tracking over the foot.','Quadriceps','Glutes',false),
 ('Calf Raises','STRENGTH','BEGINNER','Use a full controlled range and pause at the top.','Calves',NULL,false),
 ('Push-ups','STRENGTH','BEGINNER','Keep a straight body line and lower the chest under control.','Chest','Triceps, Shoulders',false),
 ('Pull-ups','STRENGTH','INTERMEDIATE','Start from a controlled hang and pull the chest toward the bar.','Back','Biceps',false),
 ('Planks','FUNCTIONAL','BEGINNER','Brace the trunk and maintain a neutral spine.','Core',NULL,false),
 ('Mountain Climbers','CARDIO','BEGINNER','Keep the shoulders stacked and alternate knees at a steady pace.','Full Body','Core',false),
 ('Glute Bridges','STRENGTH','BEGINNER','Drive through the heels and squeeze the glutes at the top.','Glutes','Hamstrings',false),
 ('Burpees','CARDIO','INTERMEDIATE','Move through each phase with control and land softly.','Full Body','Cardio',false),
 ('Side Planks','FUNCTIONAL','BEGINNER','Stack the hips and maintain a straight line through the body.','Core','Shoulders',false),
 ('Bird Dogs','MOBILITY','BEGINNER','Extend opposite limbs without rotating the pelvis.','Core','Back',false),
 ('Dead Bugs','FUNCTIONAL','BEGINNER','Keep the lower back supported as opposite limbs extend.','Core',NULL,false)
) AS v(name, discipline, difficulty, instructions, primary_group, secondary_group, requires_weight)
WHERE NOT EXISTS (SELECT 1 FROM exercises e WHERE lower(e.name) = lower(v.name));
