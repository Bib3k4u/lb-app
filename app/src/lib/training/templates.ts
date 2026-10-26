import type { Exercise, WorkoutTemplate } from './types';

// The same three starter programmes and copy-a-day workflow used by the
// reference application, expressed as app-native data so it also works offline.
export const workoutTemplates: WorkoutTemplate[] = [
  {
    id: 'ppl-6day',
    name: 'Push / Pull / Legs',
    description: 'A six-day split with heavy and volume sessions for balanced hypertrophy.',
    level: 'Intermediate · 6 days',
    days: [
      { day: 1, name: 'Push — Heavy', focus: 'Chest, shoulders, triceps', exercises: [
        { exerciseName: 'Bench Press', sets: 4, reps: 6 }, { exerciseName: 'Incline Bench Press', sets: 3, reps: 8 },
        { exerciseName: 'Overhead Press', sets: 3, reps: 6 }, { exerciseName: 'Lateral Raise', sets: 3, reps: 12 },
        { exerciseName: 'Triceps Pushdown', sets: 3, reps: 10 },
      ] },
      { day: 2, name: 'Pull — Heavy', focus: 'Back, biceps, forearms', exercises: [
        { exerciseName: 'Deadlift', sets: 3, reps: 5 }, { exerciseName: 'Barbell Row', sets: 4, reps: 8 },
        { exerciseName: 'Pull-Up', sets: 3, reps: 6 }, { exerciseName: 'Barbell Curl', sets: 3, reps: 10 },
        { exerciseName: 'Hammer Curl', sets: 3, reps: 10 },
      ] },
      { day: 3, name: 'Legs — Heavy', focus: 'Quads, hamstrings, glutes', exercises: [
        { exerciseName: 'Squat', sets: 4, reps: 6 }, { exerciseName: 'Romanian Deadlift', sets: 3, reps: 8 },
        { exerciseName: 'Leg Press', sets: 3, reps: 10 }, { exerciseName: 'Leg Curl', sets: 3, reps: 12 },
        { exerciseName: 'Leg Extension', sets: 3, reps: 12 },
      ] },
      { day: 4, name: 'Push — Volume', focus: 'Chest, shoulders, triceps', exercises: [
        { exerciseName: 'Dumbbell Fly', sets: 3, reps: 12 }, { exerciseName: 'Push-Up', sets: 3, reps: 15 },
        { exerciseName: 'Arnold Press', sets: 3, reps: 10 }, { exerciseName: 'Front Raise', sets: 3, reps: 12 },
        { exerciseName: 'Close-Grip Bench Press', sets: 3, reps: 8 },
      ] },
      { day: 5, name: 'Pull — Volume', focus: 'Back, biceps, rear delts', exercises: [
        { exerciseName: 'Lat Pulldown', sets: 4, reps: 10 }, { exerciseName: 'Face Pull', sets: 3, reps: 15 },
        { exerciseName: 'Barbell Row', sets: 3, reps: 10 }, { exerciseName: 'Dumbbell Curl', sets: 3, reps: 12 },
        { exerciseName: 'Preacher Curl', sets: 3, reps: 10 },
      ] },
      { day: 6, name: 'Legs — Volume', focus: 'Quads, hamstrings, glutes', exercises: [
        { exerciseName: 'Leg Press', sets: 4, reps: 12 }, { exerciseName: 'Leg Extension', sets: 3, reps: 15 },
        { exerciseName: 'Romanian Deadlift', sets: 3, reps: 10 }, { exerciseName: 'Squat', sets: 3, reps: 10 },
        { exerciseName: 'Leg Curl', sets: 3, reps: 12 },
      ] },
    ],
  },
  {
    id: 'basic-strength-3day',
    name: 'Basic Strength',
    description: 'A simple three-day introduction built around dependable movement patterns.',
    level: 'Beginner · 3 days',
    days: [
      { day: 1, name: 'Push Day', focus: 'Chest, shoulders, triceps', exercises: [
        { exerciseName: 'Push-ups', sets: 3, reps: 10, weight: 0 }, { exerciseName: 'Dips', sets: 3, reps: 8, weight: 0 },
        { exerciseName: 'Planks', sets: 3, reps: 1, seconds: 45, weight: 0 },
      ] },
      { day: 2, name: 'Pull Day', focus: 'Back and biceps', exercises: [
        { exerciseName: 'Pull-ups', sets: 3, reps: 5, weight: 0 }, { exerciseName: 'Rows', sets: 3, reps: 10 },
        { exerciseName: 'Superman', sets: 3, reps: 10, weight: 0 },
      ] },
      { day: 3, name: 'Legs Day', focus: 'Quads, hamstrings, glutes', exercises: [
        { exerciseName: 'Squats', sets: 3, reps: 12, weight: 0 }, { exerciseName: 'Lunges', sets: 3, reps: 10, weight: 0 },
        { exerciseName: 'Calf Raises', sets: 3, reps: 15, weight: 0 },
      ] },
    ],
  },
  {
    id: 'full-body-3day',
    name: 'Full Body Foundation',
    description: 'Three varied full-body sessions for strength, conditioning and stability.',
    level: 'Beginner · 3 days',
    days: [
      { day: 1, name: 'Full Body A', focus: 'Upper-body compounds', exercises: [
        { exerciseName: 'Push-ups', sets: 3, reps: 8, weight: 0 }, { exerciseName: 'Squats', sets: 3, reps: 15, weight: 0 },
        { exerciseName: 'Planks', sets: 3, reps: 1, seconds: 45, weight: 0 }, { exerciseName: 'Mountain Climbers', sets: 3, reps: 20, weight: 0 },
      ] },
      { day: 2, name: 'Full Body B', focus: 'Lower-body compounds', exercises: [
        { exerciseName: 'Lunges', sets: 3, reps: 12, weight: 0 }, { exerciseName: 'Dips', sets: 3, reps: 6, weight: 0 },
        { exerciseName: 'Glute Bridges', sets: 3, reps: 15, weight: 0 }, { exerciseName: 'Burpees', sets: 3, reps: 8, weight: 0 },
      ] },
      { day: 3, name: 'Full Body C', focus: 'Core and stability', exercises: [
        { exerciseName: 'Planks', sets: 3, reps: 1, seconds: 60, weight: 0 }, { exerciseName: 'Side Planks', sets: 3, reps: 1, seconds: 30, weight: 0 },
        { exerciseName: 'Bird Dogs', sets: 3, reps: 10, weight: 0 }, { exerciseName: 'Dead Bugs', sets: 3, reps: 12, weight: 0 },
      ] },
    ],
  },
];

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/s$/, '');

export function matchExercise(name: string, exercises: Exercise[]) {
  const wanted = normalize(name);
  return exercises.find((exercise) => normalize(exercise.name) === wanted)
    ?? exercises.find((exercise) => normalize(exercise.name).includes(wanted) || wanted.includes(normalize(exercise.name)));
}
