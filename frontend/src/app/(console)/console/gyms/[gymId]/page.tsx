"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin } from "lucide-react";
import Link from "next/link";
import { fetchAllGyms } from "@/lib/api/platform";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";

const stateTone: Record<string, "good" | "alert" | "accent" | "neutral"> = {
  LIVE: "good",
  VERIFIED: "accent",
  PENDING_VERIFICATION: "accent",
  SUSPENDED: "alert",
  REJECTED: "alert",
  CLOSED: "neutral",
};

export default function GymDetailPage() {
  const { gymId } = useParams<{ gymId: string }>();
  const query = useQuery({ queryKey: ["platform-gyms-all"], queryFn: fetchAllGyms });

  const gym = query.data?.find((g) => g.id === gymId);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/console/gyms" className="flex items-center gap-1.5 text-sm text-lb-ink2 hover:text-lb-ink">
        <ArrowLeft className="size-3.5" /> Back to gyms
      </Link>

      {query.isLoading ? (
        <SkeletonRows rows={4} />
      ) : query.isError ? (
        <ErrorState message="Couldn't load this gym." onRetry={() => query.refetch()} />
      ) : !gym ? (
        <ErrorState message="Gym not found." />
      ) : (
        <>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold">{gym.tradingName ?? gym.legalName}</h1>
            <Badge tone={stateTone[gym.state]}>{gym.state.replace(/_/g, " ")}</Badge>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <GlassCard>
              <h2 className="font-bold">Registrant</h2>
              <p className="mt-2 text-sm text-lb-ink2">
                {gym.registrant.firstName} {gym.registrant.lastName}
              </p>
              <p className="text-sm text-lb-ink2">{gym.registrant.email}</p>
              <p className="text-sm text-lb-ink2">{gym.registrant.phoneE164}</p>
              {gym.gstin && <p className="mt-2 text-xs text-lb-dim">GSTIN: {gym.gstin}</p>}
            </GlassCard>

            <GlassCard>
              <h2 className="font-bold">Locations ({gym.locations.length})</h2>
              <div className="mt-3 flex flex-col gap-2">
                {gym.locations.map((loc) => (
                  <div key={loc.id} className="flex items-start gap-2 rounded-[var(--radius-lb-field)] bg-lb-glass px-3 py-2.5 text-sm">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-lb-ink2" />
                    <div>
                      <p className="font-medium">{loc.name}</p>
                      <p className="text-lb-ink2">
                        {loc.city}, {loc.state}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </>
      )}
    </div>
  );
}
