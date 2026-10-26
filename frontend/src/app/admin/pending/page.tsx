"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/** The pending-gym status now lives on the console dashboard itself
 *  (ConsoleDashboardPage's AwaitingActivation branch), so this route is kept
 *  only so an old bookmark or link still lands somewhere sensible. */
export default function AdminPendingRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/console");
  }, [router]);

  return (
    <div className="lb-zone-dark flex min-h-dvh items-center justify-center">
      <Loader2 className="size-6 animate-spin text-lb-accent" />
    </div>
  );
}
