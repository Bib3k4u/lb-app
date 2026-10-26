/**
 * Token storage and refresh.
 *
 * LB-ENG-1.0 §7: tokens live in expo-secure-store (Keychain / Keystore) and
 * NEVER in AsyncStorage, which is unencrypted plaintext readable on a rooted
 * or jailbroken device. This is not a preference.
 */
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import Constants from 'expo-constants';

const ACCESS_KEY = 'lb.access_token';
const REFRESH_KEY = 'lb.refresh_token';

const BASE_URL =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  'http://localhost:8080/api/v1';

/** Listeners so the UI can react to sign-out triggered from the interceptor. */
type SessionListener = (signedIn: boolean) => void;
const listeners = new Set<SessionListener>();

export function onSessionChange(fn: SessionListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(signedIn: boolean) {
  listeners.forEach((fn) => fn(signedIn));
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_KEY);
}

export async function storeSession(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
  notify(true);
}

/** Returns true when a fresh access token was obtained. */
export async function refreshSession(): Promise<boolean> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refreshToken) return false;

  try {
    // Deliberately a bare axios call, not the shared instance: using `api` here
    // would re-enter its own 401 interceptor and recurse.
    const { data } = await axios.post<{
      accessToken: string;
      refreshToken: string;
    }>(`${BASE_URL}/auth/refresh`, { refreshToken });

    await storeSession(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export async function signOut(): Promise<void> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  // Best-effort, and deliberately not awaited-through-to-failure: local
  // sign-out must succeed even if the network call does not (offline, an
  // already-expired session, a slow connection) — a bare axios call, not
  // the shared `api` instance, since that would import this module back in.
  if (refreshToken) {
    void axios.post(`${BASE_URL}/auth/sign-out`, { refreshToken }).catch(() => {});
  }
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
  notify(false);
}

export async function isSignedIn(): Promise<boolean> {
  return (await getAccessToken()) !== null;
}
