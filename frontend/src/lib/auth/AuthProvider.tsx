"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { fetchMe, login as apiLogin, loginWithGoogle as apiLoginWithGoogle, registerWithGoogle as apiRegisterWithGoogle, logout as apiLogout } from "@/lib/api/auth";
import { MeResponse } from "@/lib/api/types";
import { session } from "@/lib/auth/session";

interface AuthContextValue {
  user: MeResponse | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<MeResponse>;
  loginWithGoogle: (idToken: string) => Promise<MeResponse>;
  registerWithGoogle: (idToken: string) => Promise<MeResponse>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    // No stored session: signed out, nothing to ask the server.
    if (!session.hasSession()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await fetchMe();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial session hydration from the httpOnly cookie — runs once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const { user: me } = await apiLogin(email, password);
    setUser(me);
    return me;
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const { user: me } = await apiLoginWithGoogle(idToken);
    setUser(me);
    return me;
  }, []);

  const registerWithGoogle = useCallback(async (idToken: string) => {
    const { user: me } = await apiRegisterWithGoogle(idToken);
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, registerWithGoogle, logout, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
