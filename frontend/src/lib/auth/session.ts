"use client";

/**
 * Browser-side session: the JWT access token and refresh token live in
 * localStorage and are sent to the backend directly as `Authorization: Bearer`.
 * Every access is wrapped, because storage can be unavailable (private mode,
 * blocked site data) — the app then simply behaves as signed out.
 */

const ACCESS = "lb_at";
const REFRESH = "lb_rt";
const GYM = "lb_gym";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Session just won't persist across reloads. */
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const session = {
  accessToken: () => read(ACCESS),
  refreshToken: () => read(REFRESH),
  activeGymId: () => read(GYM),
  hasSession: () => Boolean(read(ACCESS) || read(REFRESH)),
  save(accessToken: string, refreshToken: string) {
    write(ACCESS, accessToken);
    write(REFRESH, refreshToken);
  },
  setActiveGym(gymId: string) {
    write(GYM, gymId);
  },
  clear() {
    remove(ACCESS);
    remove(REFRESH);
    remove(GYM);
  },
};
