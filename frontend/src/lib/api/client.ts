"use client";

import { session } from "@/lib/auth/session";
import { ApiError, ProblemDetails } from "./types";

// The browser talks to the backend directly. Set NEXT_PUBLIC_API_BASE_URL for
// any deployed environment; the backend's CORS allowlist must include this
// site's origin (CORS_ALLOWED_ORIGINS).
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api/v1").replace(/\/$/, "");

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

let refreshing: Promise<boolean> | null = null;

/** Trades the refresh token for a new pair. Single-flight, because refresh
 *  tokens are single-use: two parallel 401s must share one refresh. */
function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing;
  const refreshToken = session.refreshToken();
  if (!refreshToken) return Promise.resolve(false);
  refreshing = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 400) session.clear();
        return false;
      }
      const tokens = (await res.json()) as Tokens;
      session.save(tokens.accessToken, tokens.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

function buildHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers({ "content-type": "application/json" });
  new Headers(extra).forEach((value, key) => headers.set(key, value));
  const token = session.accessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const gymId = session.activeGymId();
  if (gymId && !headers.has("X-Gym-Id")) headers.set("X-Gym-Id", gymId);
  return headers;
}

async function send(path: string, options: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_BASE_URL}/${path}`, { ...options, headers: buildHeaders(options.headers) });
  } catch {
    throw new ApiError({
      title: "Service unavailable",
      status: 503,
      detail: "Couldn't reach the server. Please try again in a moment.",
      code: "SERVICE_UNAVAILABLE",
    } as ProblemDetails);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await send(path, options);

  // Expired access token: refresh once and retry.
  if (res.status === 401 && session.refreshToken() && (await refreshSession())) {
    res = await send(path, options);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    throw new ApiError((data as ProblemDetails) ?? { title: "Request failed", status: res.status });
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown, extra?: RequestInit) =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined, ...extra }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export function idempotencyHeaders(key: string): RequestInit {
  return { headers: { "Idempotency-Key": key } };
}

export function toQuery(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}
