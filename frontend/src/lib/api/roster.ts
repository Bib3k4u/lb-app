"use client";

import { api } from "./client";
import { PersonSummary, Role, TrainerSummary } from "./types";

export function fetchRoster() {
  return api.get<PersonSummary[]>("roster");
}

export function deactivatePerson(userId: string, role: Role, planId?: string) {
  return api.post<void>(`roster/${userId}/deactivation`, { role, planId });
}

export function reactivatePerson(userId: string, role: Role, planId?: string) {
  return api.post<void>(`roster/${userId}/reactivation`, { role, planId });
}

export function fetchTrainersAtLocation(locationId: string) {
  return api.get<TrainerSummary[]>(`locations/${locationId}/trainers`);
}

export function assignTrainer(memberRecordId: string, trainerUserId: string) {
  return api.put<void>(`members/${memberRecordId}/trainer`, { trainerUserId });
}

export function unassignTrainer(memberRecordId: string) {
  return api.del<void>(`members/${memberRecordId}/trainer`);
}
