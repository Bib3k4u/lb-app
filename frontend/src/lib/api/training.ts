"use client";

import { api, toQuery } from "./client";
import {
  DietPlanInput,
  DietPlanView,
  ExerciseInput,
  ExerciseView,
  FoodSearchItem,
  MetricInput,
  MetricView,
  NutritionDayView,
  NutritionEntryInput,
  NutritionEntryView,
  NutritionHistoryDay,
  ProgressView,
  WorkoutInput,
  WorkoutView,
} from "./types";

// --- Diet plans ---

export function fetchDietPlan(userId: string) {
  return api.get<DietPlanView | null>(`users/${userId}/diet-plan`);
}

export function fetchDietPlanHistory(userId: string) {
  return api.get<DietPlanView[]>(`users/${userId}/diet-plans/history`);
}

export function createDietPlan(userId: string, input: DietPlanInput) {
  return api.post<DietPlanView>(`users/${userId}/diet-plans`, input);
}

export function archiveDietPlan(userId: string, planId: string) {
  return api.del<void>(`users/${userId}/diet-plans/${planId}`);
}

// --- Nutrition ---

export function fetchNutritionDay(userId: string, date: string) {
  return api.get<NutritionDayView>(`users/${userId}/nutrition${toQuery({ date })}`);
}

export function fetchNutritionHistory(userId: string, days: number) {
  return api.get<NutritionHistoryDay[]>(`users/${userId}/nutrition/history${toQuery({ days })}`);
}

export function addNutritionEntry(userId: string, input: NutritionEntryInput) {
  return api.post<NutritionEntryView>(`users/${userId}/nutrition/entries`, input);
}

export function deleteNutritionEntry(entryId: string) {
  return api.del<void>(`nutrition/entries/${entryId}`);
}

export function searchFoods(query: string) {
  return api.get<FoodSearchItem[]>(`nutrition/foods/search${toQuery({ q: query })}`);
}

// --- Progress ---

export function fetchProgress(userId: string) {
  return api.get<ProgressView>(`users/${userId}/progress`);
}

export function addProgressMetric(userId: string, input: MetricInput) {
  return api.post<MetricView>(`users/${userId}/progress/metrics`, input);
}

// --- Exercises & workouts ---

export function fetchExercises() {
  return api.get<ExerciseView[]>("exercises");
}

export function createExercise(input: ExerciseInput) {
  return api.post<ExerciseView>("exercises", input);
}

export function fetchWorkouts(userId: string) {
  return api.get<WorkoutView[]>(`me/workouts${toQuery({ memberId: userId })}`);
}

export function createWorkout(input: WorkoutInput) {
  return api.post<WorkoutView>("me/workouts", input);
}

export function completeWorkout(workoutId: string) {
  return api.post<WorkoutView>(`me/workouts/${workoutId}/complete`, {});
}

export function reopenWorkout(workoutId: string) {
  return api.post<WorkoutView>(`me/workouts/${workoutId}/reopen`, {});
}

export function deleteWorkout(workoutId: string) {
  return api.del<void>(`me/workouts/${workoutId}`);
}
