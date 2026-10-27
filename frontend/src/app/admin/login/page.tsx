"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { LogIn, Mail } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { AuthBusyOverlay } from "@/components/auth/AuthBusyOverlay";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ApiError } from "@/lib/api/types";
import { canUseConsole, isNonAdminWithRoles } from "@/lib/auth/permissions";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginContent />
    </Suspense>
  );
}

const NOT_ADMIN_MESSAGE = "This portal is for gym admins. Please use the LimitBeyond app.";

function AdminLoginContent() {
  const router = useRouter();
  const denied = useSearchParams().has("denied");
  const { user, loading: authLoading, login, registerWithGoogle, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const googleEnabled = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
  const [error, setError] = useState<string | null>(denied ? NOT_ADMIN_MESSAGE : null);

  // Already signed in (session cookies survive across visits): go straight in.
  useEffect(() => {
    if (!authLoading && user && !googleBusy) {
      if (canUseConsole(user)) router.replace("/console");
      else if (isNonAdminWithRoles(user)) void logout(); // a member or trainer has no business here
      else router.replace("/admin/register");
    }
  }, [authLoading, user, googleBusy, logout, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const me = await login(email, password);
      if (canUseConsole(me)) router.push("/console");
      else router.push("/admin/register");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // One Google button for everyone: an existing account goes to its dashboard
  // (or its pending-review page); a brand-new Google account continues to the
  // gym registration form. The backend signs in or creates, the page routes.
  async function onGoogleCredential(idToken: string) {
    setGoogleBusy(true);
    setError(null);
    try {
      const me = await registerWithGoogle(idToken);
      // Stay busy until the next page has taken over.
      if (canUseConsole(me)) router.push("/console");
      else router.push("/admin/register");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setGoogleBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm">

      <GlassCard raised className="relative">
        {googleBusy && <AuthBusyOverlay label="Signing you in…" />}
        <h1 className="text-xl font-bold">Admin login</h1>
        <p className="mt-1 text-sm text-lb-ink2">Sign in to manage your gym.</p>

        {googleEnabled && (
          <div className="mt-6">
            <GoogleSignInButton onCredential={onGoogleCredential} text="continue_with" />
            <div className="mt-5 flex items-center gap-3 text-xs text-lb-dim">
              <span className="h-px flex-1 bg-lb-glass-line-2" />
              or sign in with email
              <span className="h-px flex-1 bg-lb-glass-line-2" />
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className={`flex flex-col gap-4 ${googleEnabled ? "mt-5" : "mt-6"}`}>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftAdornment={<Mail className="size-4" />}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <p className="text-sm text-lb-alert">
              {error}
              {error.startsWith("No account is linked") && (
                <>
                  {" "}
                  <Link href="/admin/register" className="font-semibold underline">
                    Register your gym with Google
                  </Link>{" "}
                  to create one.
                </>
              )}
            </p>
          )}

          <Button type="submit" loading={loading} fullWidth size="lg" className="mt-2">
            <LogIn className="size-4" /> Sign in
          </Button>
        </form>

        <div className="mt-6 flex flex-col gap-2 text-center text-sm text-lb-ink2">
          <Link href="/admin/forgot-password" className="hover:text-lb-ink">
            Forgot password?
          </Link>
          <span>
            New gym owner?{" "}
            <Link href="/admin/register" className="font-semibold text-lb-accent hover:underline">
              Register your gym
            </Link>
          </span>
        </div>
      </GlassCard>
    </div>
  );
}
