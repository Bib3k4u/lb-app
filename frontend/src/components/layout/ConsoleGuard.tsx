"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { canUseConsole, isNonAdminWithRoles } from "@/lib/auth/permissions";

export function ConsoleGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  // Only admin roles belong here (a gym awaiting review is let in to see its
  // status). Members and trainers hold grants too but never get in. The backend
  // enforces the same rule at sign-in and on every request; this only keeps the
  // UI from rendering for someone who has no business here.
  const authorized = canUseConsole(user);
  const turnedAway = isNonAdminWithRoles(user);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/admin/login");
      return;
    }
    if (turnedAway) {
      // Sign out first, so the login page doesn't send them straight back here.
      void logout().finally(() => router.replace("/admin/login?denied=1"));
      return;
    }
    if (!authorized) {
      router.replace("/admin/register");
    }
  }, [loading, user, authorized, turnedAway, logout, router]);

  if (loading || !authorized) {
    return (
      <div className="lb-zone-dark flex min-h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-lb-accent" />
      </div>
    );
  }

  return <>{children}</>;
}
