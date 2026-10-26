/**
 * HTTP client. One instance, one place where auth and errors are handled.
 *
 * Note for when the backend exists: this file is a stop-gap. LB-ARCH ADR-13
 * specifies TypeScript clients GENERATED from the backend's OpenAPI document
 * into packages/api-client. Hand-written request functions are what drift
 * silently when an endpoint changes; generated ones fail the build instead.
 * Keep this thin so replacing it later is trivial.
 */
import {
  create,
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
import Constants from 'expo-constants';
import { getAccessToken, refreshSession, signOut } from '../auth/session';

const BASE_URL =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  'http://localhost:8080/api/v1';

export const api: AxiosInstance = create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<boolean> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retried?: boolean;
    };

    // Access tokens live 15 minutes (ADR-08). One transparent refresh per
    // request, then give up — a refresh loop on a revoked session is worse
    // than a clean sign-out.
    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      refreshing ??= refreshSession().finally(() => {
        refreshing = null;
      });
      const ok = await refreshing;
      if (ok) return api(original);
      await signOut();
    }
    return Promise.reject(error);
  },
);

/** RFC 7807 Problem Details, as produced by the backend's single error handler. */
export interface ProblemDetail {
  title?: string;
  detail?: string;
  status?: number;
  code?: string; // stable, switchable — prefer this over the message
  correlationId?: string; // quote this to find the failure in the logs
}

export function problemFrom(error: unknown): ProblemDetail {
  const e = error as AxiosError<ProblemDetail>;
  return (
    e.response?.data ?? {
      title: 'Network error',
      detail: 'Could not reach LIMITBEYOND. Check your connection and try again.',
      status: 0,
    }
  );
}
