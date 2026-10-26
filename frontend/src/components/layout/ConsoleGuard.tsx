"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isSuperAdmin, primaryGymId } from "@/lib/auth/permissions";

export function ConsoleGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const grants = user?.grants ?? [];
  // A gym that's registered but not yet activated (FR-AUTH-16) holds no
  // grants yet — that's still a legitimate console visitor, just one who
  // sees their gym's status on the dashboard instead of real data, not
  // someone to turn away. Only a genuinely unfinished sign-up (no grants,
  // no gym at all) has nothing to show here.
  const authorized = user && (isSuperAdmin(grants) || primaryGymId(grants) !== null || Boolean(user.pendingGym));

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/admin/login");
      return;
    }
    if (!authorized) {
      router.replace("/admin/register");
    }
  }, [loading, user, authorized, router]);

  if (loading || !authorized) {
    return (
      <div className="lb-zone-dark flex min-h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-lb-accent" />
      </div>
    );
  }

  return <>{children}</>;
}
