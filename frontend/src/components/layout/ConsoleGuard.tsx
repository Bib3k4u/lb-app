"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isAdmin } from "@/lib/auth/permissions";

export function ConsoleGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const grants = user?.grants ?? [];
  // Only admin roles belong here. A gym that's registered but not yet
  // activated (FR-AUTH-16) holds no grants yet — that's still a legitimate
  // console visitor, who sees their gym's status instead of real data.
  // Members and trainers hold grants too, but never get in. The backend
  // enforces the same rule at sign-in and on every request; this only keeps
  // the UI from rendering for someone who has no business here.
  const authorized = user && (isAdmin(grants) || Boolean(user.pendingGym));

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
