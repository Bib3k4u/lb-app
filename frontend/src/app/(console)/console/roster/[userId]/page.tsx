"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, UserCheck, UserX } from "lucide-react";
import { assignTrainer, fetchRoster, fetchTrainersAtLocation, unassignTrainer } from "@/lib/api/roster";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { useToast } from "@/components/ui/Toast";
import { NutritionTab } from "@/components/training/NutritionTab";
import { PerformanceTab } from "@/components/training/PerformanceTab";
import { WorkoutsTab } from "@/components/training/WorkoutsTab";
import Link from "next/link";

type Tab = "overview" | "nutrition" | "performance" | "workouts";

export default function PersonDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");

  const rosterQuery = useQuery({ queryKey: ["roster"], queryFn: fetchRoster });
  const person = rosterQuery.data?.find((p) => p.userId === userId);

  const trainersQuery = useQuery({
    queryKey: ["location-trainers", person?.locationIds[0]],
    queryFn: () => fetchTrainersAtLocation(person!.locationIds[0]),
    enabled: !!person && person.role === "MEMBER" && person.locationIds.length > 0,
  });

  const assignMutation = useMutation({
    mutationFn: (trainerUserId: string) => assignTrainer(person!.memberRecordId!, trainerUserId),
    onSuccess: () => {
      push("success", "Trainer assigned.");
      queryClient.invalidateQueries({ queryKey: ["roster"] });
    },
    onError: () => push("error", "Couldn't assign a trainer."),
  });

  const unassignMutation = useMutation({
    mutationFn: () => unassignTrainer(person!.memberRecordId!),
    onSuccess: () => {
      push("success", "Trainer unassigned.");
      queryClient.invalidateQueries({ queryKey: ["roster"] });
    },
    onError: () => push("error", "Couldn't unassign the trainer."),
  });

  if (rosterQuery.isLoading) return <SkeletonRows rows={4} />;
  if (rosterQuery.isError) return <ErrorState message="Couldn't load this person." onRetry={() => rosterQuery.refetch()} />;
  if (!person) return <ErrorState message="Person not found." />;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/console/roster" className="flex items-center gap-1.5 text-sm text-lb-ink2 hover:text-lb-ink">
        <ArrowLeft className="size-3.5" /> Back to roster
      </Link>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-extrabold">
          {person.firstName} {person.lastName}
        </h1>
        <Badge tone="accent">{person.role.replace(/_/g, " ")}</Badge>
      </div>

      <Tabs
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "nutrition", label: "Nutrition" },
          { key: "performance", label: "Performance" },
          { key: "workouts", label: "Workouts" },
        ]}
        active={tab}
        onChange={(k) => setTab(k as Tab)}
      />

      {tab === "nutrition" && <NutritionTab userId={person.userId} />}
      {tab === "performance" && <PerformanceTab userId={person.userId} />}
      {tab === "workouts" && <WorkoutsTab userId={person.userId} />}

      {tab === "overview" && (
      <div className="grid gap-5 lg:grid-cols-2">
        <GlassCard>
          <h2 className="font-bold">Contact</h2>
          <p className="mt-2 text-sm text-lb-ink2">{person.email ?? "No email on file"}</p>
          <p className="text-sm text-lb-ink2">{person.phoneE164 ?? "No phone on file"}</p>
          <p className="mt-3 text-xs text-lb-dim">Granted {new Date(person.grantedAt).toLocaleDateString()}</p>
        </GlassCard>

        {person.membership && (
          <GlassCard>
            <h2 className="font-bold">Membership</h2>
            <p className="mt-2 text-sm text-lb-ink2">{person.membership.planName}</p>
            <p className="text-sm text-lb-ink2">Expires {new Date(person.membership.expiresOn).toLocaleDateString()}</p>
            <Badge tone={person.membership.currentlyActive ? "good" : "alert"} className="mt-2">
              {person.membership.currentlyActive ? "Active" : "Inactive"}
            </Badge>
          </GlassCard>
        )}

        {person.role === "MEMBER" && (
          <GlassCard>
            <h2 className="font-bold">Assigned trainer</h2>
            {person.assignedTrainer ? (
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm">
                  {person.assignedTrainer.firstName} {person.assignedTrainer.lastName}
                </span>
                <Button size="sm" variant="subtle" onClick={() => unassignMutation.mutate()} loading={unassignMutation.isPending}>
                  <UserX className="size-3.5" /> Unassign
                </Button>
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {trainersQuery.data?.length ? (
                  trainersQuery.data.map((t) => (
                    <div key={t.userId} className="flex items-center justify-between rounded-[var(--radius-lb-field)] bg-lb-glass px-3 py-2 text-sm">
                      <span>
                        {t.firstName} {t.lastName}
                      </span>
                      <Button size="sm" onClick={() => assignMutation.mutate(t.userId)} loading={assignMutation.isPending}>
                        <UserCheck className="size-3.5" /> Assign
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-lb-ink2">No trainers available at this location.</p>
                )}
              </div>
            )}
          </GlassCard>
        )}
      </div>
      )}
    </div>
  );
}
