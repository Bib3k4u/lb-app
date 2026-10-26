"use client";

import { api, idempotencyHeaders } from "./client";
import { GymRegistrationInput, GymSummary, RevenueSummary, SubscriptionOffering } from "./types";

export function registerGym(input: GymRegistrationInput) {
  return api.post<{ id: string }>("platform/gyms", input);
}

export function fetchPendingGyms() {
  return api.get<GymSummary[]>("platform/gyms/pending");
}

export function fetchAllGyms() {
  return api.get<GymSummary[]>("platform/gyms");
}

export function fetchRevenueSummary() {
  return api.get<RevenueSummary>("platform/gyms/revenue");
}

export function decideGymVerification(gymId: string, input: { approved: boolean; reason?: string }) {
  return api.post<void>(`platform/gyms/${gymId}/verification`, input);
}

export function deactivateGym(gymId: string, reason: string) {
  return api.post<void>(`platform/gyms/${gymId}/deactivation`, { reason });
}

export function reactivateGym(gymId: string) {
  return api.post<void>(`platform/gyms/${gymId}/reactivation`, {});
}

export function closeGym(gymId: string) {
  return api.del<void>(`platform/gyms/${gymId}`);
}

export function fetchDefaultSubscriptionOffering() {
  return api.get<SubscriptionOffering>("platform/subscription-offerings/default");
}

export interface SubscriptionPaymentInput {
  offeringId: string;
  amountMinor: number;
  method: string;
  reference?: string;
  receivedOn: string;
}

export function recordSubscriptionPayment(gymId: string, input: SubscriptionPaymentInput, idempotencyKey: string) {
  return api.post<{ id: string }>(
    `platform/gyms/${gymId}/subscription-payments`,
    input,
    idempotencyHeaders(idempotencyKey),
  );
}
