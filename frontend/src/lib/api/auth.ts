"use client";

import { api } from "./client";
import { session } from "@/lib/auth/session";
import { MeResponse, PersonSummary, VerificationDecisionInput } from "./types";

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: MeResponse;
}

/** Calls one of the token-issuing endpoints on the backend and keeps the
 *  returned JWT pair in localStorage. */
async function authenticate(path: string, body: unknown): Promise<{ user: MeResponse }> {
  const data = await api.post<TokenResponse>(path, body);
  session.save(data.accessToken, data.refreshToken);
  return { user: data.user };
}

export function login(email: string, password: string) {
  return authenticate("auth/login", { email, password });
}

export function loginWithGoogle(idToken: string) {
  return authenticate("auth/google", { idToken });
}

export function registerWithGoogle(idToken: string) {
  return authenticate("auth/google/register", { idToken });
}

export async function logout(): Promise<void> {
  const refreshToken = session.refreshToken();
  if (refreshToken) {
    try {
      // Best-effort revoke — the local session is cleared regardless.
      await api.post<void>("auth/sign-out", { refreshToken });
    } catch {
      /* ignore */
    }
  }
  session.clear();
}

export async function setActiveGym(gymId: string): Promise<void> {
  session.setActiveGym(gymId);
}

export interface AdminRegisterInput {
  phoneE164: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export function registerAdminAccount(input: AdminRegisterInput) {
  return api.post<void>("auth/admin/register", input);
}

export function requestPasswordReset(phoneE164: string) {
  return api.post<void>("auth/password/reset/request", { phoneE164 });
}

export function resetPassword(input: { phoneE164: string; code: string; newPassword: string }) {
  return api.post<void>("auth/password/reset", input);
}

export function fetchMe() {
  return api.get<MeResponse>("me");
}

export function updateMe(
  input: Partial<{
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    heightCm: number;
    experienceLevel: string;
    primaryGoal: string;
  }>,
) {
  return api.patch<MeResponse>("me", input);
}

export function fetchPendingVerifications() {
  return api.get<PersonSummary[]>("verifications/pending");
}

export function decideVerification(userId: string, input: VerificationDecisionInput) {
  return api.post<void>(`verifications/${userId}`, input);
}
