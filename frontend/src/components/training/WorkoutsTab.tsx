"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Dumbbell, Plus, Trash2 } from "lucide-react";
import { completeWorkout, deleteWorkout, fetchWorkouts, reopenWorkout } from "@/lib/api/training";
import { SetView, WorkoutView } from "@/lib/api/types";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { WorkoutBuilderModal } from "./WorkoutBuilderModal";

function groupSetsByExercise(sets: SetView[]) {
  const map = new Map<string, { exerciseId: string; exerciseName: string; sets: SetView[] }>();
  for (const s of sets) {
    if (!map.has(s.exerciseId)) map.set(s.exerciseId, { exerciseId: s.exerciseId, exerciseName: s.exerciseName, sets: [] });
    map.get(s.exerciseId)!.sets.push(s);
  }
  return [...map.values()];
}

export function WorkoutsTab({ userId }: { userId: string }) {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [assigning, setAssigning] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const query = useQuery({ queryKey: ["workouts", userId], queryFn: () => fetchWorkouts(userId) });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["workouts", userId] });
  }

  const completeMutation = useMutation({
    mutationFn: (id: string) => completeWorkout(id),
    onSuccess: () => {
      push("success", "Marked complete.");
      invalidate();
    },
    onError: () => push("error", "Couldn't update this workout."),
  });

  const reopenMutation = useMutation({
    mutationFn: (id: string) => reopenWorkout(id),
    onSuccess: () => {
      push("success", "Reopened.");
      invalidate();
    },
    onError: () => push("error", "Couldn't reopen this workout."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteWorkout(id),
    onSuccess: () => {
      push("success", "Deleted.");
      invalidate();
    },
    onError: () => push("error", "Couldn't delete this workout."),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
        <Button onClick={() => setAssigning(true)}>
          <Plus className="size-4" /> Assign workout
        </Button>
      </div>

      {query.isLoading ? (
        <SkeletonRows rows={4} />
      ) : query.isError ? (
        <ErrorState message="Couldn't load workouts." onRetry={() => query.refetch()} />
      ) : query.data!.length === 0 ? (
        <EmptyState icon={Dumbbell} title="No workouts yet" description="Assign this member's first workout." />
      ) : (
        <div className="flex flex-col gap-3">
          {query.data!.map((w: WorkoutView) => {
            const isOpen = expanded === w.id;
            const exerciseCount = new Set(w.sets.map((s) => s.exerciseId)).size;
            const volume = w.sets.reduce((sum, s) => sum + (s.volume ?? (s.weightKg ?? 0) * (s.reps ?? 0)), 0);
            return (
              <GlassCard key={w.id}>
                <button
                  onClick={() => setExpanded(isOpen ? null : w.id)}
                  className="flex w-full cursor-pointer items-start justify-between text-left"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{w.title}</p>
                      <Badge tone={w.completed ? "good" : "accent"}>{w.completed ? "Done" : "Planned"}</Badge>
                      {w.trainerId && <Badge tone="neutral">Assigned</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-lb-ink2">
                      {new Date(w.performedAt).toLocaleDateString()} · {w.durationMinutes} min · {exerciseCount} exercise
                      {exerciseCount === 1 ? "" : "s"} · {Math.round(volume)}kg volume
                    </p>
                    {w.targetMuscleGroups.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {w.targetMuscleGroups.map((mg) => (
                          <Badge key={mg} tone="neutral">
                            {mg}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <ChevronDown className={cn("size-4 shrink-0 text-lb-ink2 transition-transform", isOpen && "rotate-180")} />
                </button>

                {isOpen && (
                  <div className="mt-4 flex flex-col gap-3 border-t border-lb-glass-line pt-4">
                    {groupSetsByExercise(w.sets).map((group) => (
                      <div key={group.exerciseId} className="rounded-[var(--radius-lb-field)] bg-lb-glass p-3">
                        <p className="text-sm font-semibold">{group.exerciseName}</p>
                        <div className="mt-2 flex flex-col gap-1">
                          {group.sets.map((s) => (
                            <div key={s.id} className="flex items-center justify-between text-xs text-lb-ink2">
                              <span>Set {s.setNumber}</span>
                              <span className="lb-num flex items-center gap-1.5">
                                {s.reps ? `${s.reps} reps` : ""}
                                {s.weightKg ? ` × ${s.weightKg}kg` : s.seconds ? ` · ${s.seconds}s` : ""}
                                {s.completed && <Check className="size-3.5 text-lb-good" />}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {w.notes && <p className="text-sm text-lb-ink2">{w.notes}</p>}
                    <div className="flex gap-2">
                      {w.completed ? (
                        <Button size="sm" variant="ghost" onClick={() => reopenMutation.mutate(w.id)} loading={reopenMutation.isPending}>
                          Reopen
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => completeMutation.mutate(w.id)} loading={completeMutation.isPending}>
                          Mark complete
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="subtle"
                        onClick={() => confirm("Delete this workout?") && deleteMutation.mutate(w.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {assigning && <WorkoutBuilderModal userId={userId} onClose={() => setAssigning(false)} onSuccess={invalidate} />}
    </div>
  );
}
