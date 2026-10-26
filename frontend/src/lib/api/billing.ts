"use client";

import { api } from "./client";
import { PlanInput, PlanSummary } from "./types";

export function fetchPlans() {
  return api.get<PlanSummary[]>("plans");
}

export function createPlan(input: PlanInput) {
  return api.post<{ id: string }>("plans", input);
}

export function updatePlan(planId: string, input: PlanInput) {
  return api.put<void>(`plans/${planId}`, input);
}

export function deletePlan(planId: string) {
  return api.del<void>(`plans/${planId}`);
}

export function sellMembership(memberRecordId: string, input: { planId: string; startsOn: string }) {
  return api.post<{ id: string }>(`members/${memberRecordId}/memberships`, input);
}
