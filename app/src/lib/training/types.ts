export type Discipline = 'STRENGTH' | 'CARDIO' | 'FUNCTIONAL' | 'YOGA' | 'MOBILITY' | 'MEDITATION' | 'DANCE';
export type Difficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export interface Exercise {
  id: string;
  gymId: string | null;
  name: string;
  discipline: Discipline;
  difficulty: Difficulty;
  instructions: string;
  primaryMuscleGroup: string;
  secondaryMuscleGroup: string | null;
  requiresWeight: boolean;
}

export interface WorkoutSet {
  id: string;
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  reps: number | null;
  weightKg: number | null;
  seconds: number | null;
  rpe: number | null;
  notes: string | null;
  volume: number | null;
  completed: boolean;
}

export interface Workout {
  id: string;
  memberId: string;
  trainerId: string | null;
  title: string;
  description: string | null;
  targetMuscleGroups: string[];
  performedAt: string;
  durationMinutes: number;
  notes: string | null;
  locationId: string | null;
  completed: boolean;
  completedAt: string | null;
  sets: WorkoutSet[];
}

export interface WorkoutTemplateExercise {
  exerciseName: string;
  sets: number;
  reps: number;
  weight?: number;
  seconds?: number;
  notes?: string;
}

export interface WorkoutTemplateDay {
  day: number;
  name: string;
  focus: string;
  exercises: WorkoutTemplateExercise[];
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  description: string;
  level: string;
  days: WorkoutTemplateDay[];
}
