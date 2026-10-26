"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2, X } from "lucide-react";
import { createExercise, createWorkout, fetchExercises } from "@/lib/api/training";
import { ExerciseView, SetInput } from "@/lib/api/types";
import { isoToday } from "@/lib/date";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { useToast } from "@/components/ui/Toast";

interface DraftSet {
  reps?: string;
  weightKg?: string;
  seconds?: string;
}

interface DraftExercise {
  exerciseId: string;
  exerciseName: string;
  requiresWeight: boolean;
  sets: DraftSet[];
}

const MUSCLE_SUGGESTIONS = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Glutes", "Core", "Full body", "Cardio"];

export function WorkoutBuilderModal({
  userId,
  onClose,
  onSuccess,
}: {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const exercisesQuery = useQuery({ queryKey: ["exercises"], queryFn: fetchExercises });

  const [title, setTitle] = useState("");
  const [performedAt, setPerformedAt] = useState(isoToday());
  const [durationMinutes, setDurationMinutes] = useState("45");
  const [notes, setNotes] = useState("");
  const [muscleInput, setMuscleInput] = useState("");
  const [muscles, setMuscles] = useState<string[]>([]);
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
  const [creatingExercise, setCreatingExercise] = useState(false);
  const [newExerciseMuscle, setNewExerciseMuscle] = useState("");
  const [newExerciseWeighted, setNewExerciseWeighted] = useState("yes");
  const [musclesOpen, setMusclesOpen] = useState(false);
  const [exercisesOpen, setExercisesOpen] = useState(false);

  function addMuscle() {
    const v = muscleInput.trim();
    if (v && !muscles.includes(v)) setMuscles((m) => [...m, v]);
    setMuscleInput("");
  }

  function addExercise(ex: ExerciseView) {
    if (exercises.some((e) => e.exerciseId === ex.id)) return;
    setExercises((prev) => [...prev, { exerciseId: ex.id, exerciseName: ex.name, requiresWeight: ex.requiresWeight, sets: [{}] }]);
    setExerciseQuery("");
  }

  function updateSet(exIdx: number, setIdx: number, patch: Partial<DraftSet>) {
    setExercises((prev) =>
      prev.map((e, i) => (i !== exIdx ? e : { ...e, sets: e.sets.map((s, j) => (j !== setIdx ? s : { ...s, ...patch })) })),
    );
  }

  function addSet(exIdx: number) {
    setExercises((prev) => prev.map((e, i) => (i !== exIdx ? e : { ...e, sets: [...e.sets, {}] })));
  }

  function removeSet(exIdx: number, setIdx: number) {
    setExercises((prev) => prev.map((e, i) => (i !== exIdx ? e : { ...e, sets: e.sets.filter((_, j) => j !== setIdx) })));
  }

  function removeExercise(exIdx: number) {
    setExercises((prev) => prev.filter((_, i) => i !== exIdx));
  }

  const filteredExercises = (exercisesQuery.data ?? [])
    .filter((e) => e.name.toLowerCase().includes(exerciseQuery.toLowerCase()))
    .slice(0, 8);

  const createExerciseMutation = useMutation({
    mutationFn: () =>
      createExercise({
        name: exerciseQuery,
        discipline: "STRENGTH",
        difficulty: "BEGINNER",
        instructions: "Added from the workout builder.",
        primaryMuscleGroup: newExerciseMuscle || "General",
        requiresWeight: newExerciseWeighted === "yes",
      }),
    onSuccess: (created) => {
      push("success", "Exercise added to your catalogue.");
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      addExercise(created);
      setCreatingExercise(false);
      setNewExerciseMuscle("");
      setExercisesOpen(false);
    },
    onError: () => push("error", "Couldn't create this exercise."),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const sets: SetInput[] = [];
      exercises.forEach((ex) => {
        ex.sets.forEach((s, idx) => {
          sets.push({
            exerciseId: ex.exerciseId,
            setNumber: idx + 1,
            reps: s.reps ? Number(s.reps) : undefined,
            weightKg: s.weightKg ? Number(s.weightKg) : undefined,
            seconds: s.seconds ? Number(s.seconds) : undefined,
          });
        });
      });
      return createWorkout({
        title,
        memberId: userId,
        targetMuscleGroups: muscles,
        performedAt: new Date(performedAt).toISOString(),
        durationMinutes: Number(durationMinutes) || 30,
        notes: notes || undefined,
        idempotencyKey,
        sets,
      });
    },
    onSuccess: () => {
      push("success", "Workout assigned.");
      onSuccess();
      onClose();
    },
    onError: () => push("error", "Couldn't assign this workout."),
  });

  const canSubmit = title.trim().length > 0 && exercises.length > 0 && exercises.every((e) => e.sets.length > 0);

  return (
    <Modal open onClose={onClose} title="Assign workout" width="max-w-2xl">
      <div className="flex flex-col gap-4">
        <TextField label="Title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Date" type="date" value={performedAt} onChange={(e) => setPerformedAt(e.target.value)} />
          <TextField label="Duration (min)" type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
        </div>

        <div className="relative">
          <span className="text-[13px] font-medium text-current/70">Target muscles</span>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-[var(--radius-lb-field)] border border-current/15 bg-current/[0.04] px-3 py-2">
            {muscles.map((m) => (
              <span key={m} className="flex items-center gap-1 rounded-[var(--radius-lb-pill)] bg-current/10 px-2.5 py-1 text-xs text-current">
                {m}
                <button onClick={() => setMuscles((prev) => prev.filter((x) => x !== m))} className="cursor-pointer" aria-label={`Remove ${m}`}>
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <input
              value={muscleInput}
              onChange={(e) => setMuscleInput(e.target.value)}
              onFocus={() => setMusclesOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addMuscle();
                  setMusclesOpen(false);
                }
              }}
              placeholder="Type or pick below"
              className="h-6 min-w-32 flex-1 bg-transparent text-sm text-current outline-none placeholder:text-current/40"
            />
          </div>

          {musclesOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMusclesOpen(false)} />
              <div className="lb-overlay absolute top-full z-20 mt-1 w-full p-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-lb-dim">Suggestions</p>
                <div className="flex flex-wrap gap-1.5">
                  {MUSCLE_SUGGESTIONS.filter((m) => !muscles.includes(m)).map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setMuscles((prev) => [...prev, m]);
                        setMuscleInput("");
                      }}
                      className="cursor-pointer rounded-[var(--radius-lb-pill)] bg-lb-glass-2 px-3 py-1.5 text-xs text-lb-ink2 hover:bg-lb-glass-2 hover:text-lb-ink"
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <p className="mt-2.5 text-xs text-lb-dim">Or type any other muscle group and press Enter.</p>
              </div>
            </>
          )}
        </div>

        <div>
          <span className="text-[13px] font-medium text-current/70">Exercises</span>
          <div className="relative mt-1.5">
            <TextField
              placeholder="Search exercises…"
              value={exerciseQuery}
              onChange={(e) => setExerciseQuery(e.target.value)}
              onFocus={() => setExercisesOpen(true)}
              leftAdornment={<Search className="size-4" />}
            />
            {exercisesOpen && !creatingExercise && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setExercisesOpen(false)} />
                <div className="lb-overlay absolute top-full z-20 mt-1 max-h-56 w-full overflow-y-auto lb-scrollbar p-2">
                  {exercisesQuery.isLoading ? (
                    <p className="px-3 py-2 text-sm text-lb-dim">Loading exercises…</p>
                  ) : filteredExercises.length > 0 ? (
                    filteredExercises.map((ex) => (
                      <button
                        key={ex.id}
                        onClick={() => {
                          addExercise(ex);
                          setExercisesOpen(false);
                        }}
                        className="block w-full cursor-pointer rounded-[var(--radius-lb-field)] px-3 py-2 text-left text-sm text-lb-ink2 hover:bg-lb-glass-2 hover:text-lb-ink"
                      >
                        {ex.name} <span className="text-xs text-lb-dim">· {ex.primaryMuscleGroup}</span>
                      </button>
                    ))
                  ) : exerciseQuery.trim().length === 0 ? (
                    <p className="px-3 py-2 text-sm text-lb-dim">
                      {(exercisesQuery.data?.length ?? 0) === 0
                        ? "Your gym has no exercises yet — type a name below to add the first one."
                        : "Type to search your gym's exercises."}
                    </p>
                  ) : (
                    <button
                      onClick={() => setCreatingExercise(true)}
                      className="block w-full cursor-pointer rounded-[var(--radius-lb-field)] px-3 py-2 text-left text-sm font-semibold text-lb-accent hover:bg-lb-glass-2"
                    >
                      <Plus className="mr-1.5 inline size-3.5 align-[-2px]" /> Add &quot;{exerciseQuery}&quot; as a new exercise
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          {creatingExercise && (
            <div className="mt-2 flex flex-col gap-2 rounded-[var(--radius-lb-field)] bg-current/5 p-3">
              <p className="text-sm font-semibold">New exercise: {exerciseQuery}</p>
              <TextField
                label="Primary muscle group"
                placeholder="e.g. Chest"
                value={newExerciseMuscle}
                onChange={(e) => setNewExerciseMuscle(e.target.value)}
              />
              <ChipGroup
                label="Tracks weight?"
                options={[
                  { value: "yes", label: "Weighted" },
                  { value: "no", label: "Bodyweight / time-based" },
                ]}
                value={newExerciseWeighted}
                onChange={setNewExerciseWeighted}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  loading={createExerciseMutation.isPending}
                  disabled={!exerciseQuery.trim()}
                  onClick={() => createExerciseMutation.mutate()}
                >
                  Add exercise
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCreatingExercise(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {exercises.length > 0 && (
          <div className="flex flex-col gap-3">
            {exercises.map((ex, exIdx) => (
              <div key={ex.exerciseId} className="rounded-[var(--radius-lb-field)] bg-current/5 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{ex.exerciseName}</p>
                  <button
                    onClick={() => removeExercise(exIdx)}
                    className="cursor-pointer text-current/50 transition-colors hover:text-lb-alert"
                    aria-label="Remove exercise"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div className="mt-2 flex flex-col gap-1.5">
                  {ex.sets.map((s, setIdx) => (
                    <div key={setIdx} className="flex items-center gap-2">
                      <span className="lb-num w-12 text-xs text-current/50">Set {setIdx + 1}</span>
                      <input
                        type="number"
                        placeholder="Reps"
                        value={s.reps ?? ""}
                        onChange={(e) => updateSet(exIdx, setIdx, { reps: e.target.value })}
                        className="h-9 w-20 rounded-[var(--radius-lb-field)] border border-current/15 bg-current/[0.04] px-2 text-sm text-current outline-none focus:border-lb-accent"
                      />
                      {ex.requiresWeight ? (
                        <input
                          type="number"
                          placeholder="kg"
                          value={s.weightKg ?? ""}
                          onChange={(e) => updateSet(exIdx, setIdx, { weightKg: e.target.value })}
                          className="h-9 w-20 rounded-[var(--radius-lb-field)] border border-current/15 bg-current/[0.04] px-2 text-sm text-current outline-none focus:border-lb-accent"
                        />
                      ) : (
                        <input
                          type="number"
                          placeholder="sec"
                          value={s.seconds ?? ""}
                          onChange={(e) => updateSet(exIdx, setIdx, { seconds: e.target.value })}
                          className="h-9 w-20 rounded-[var(--radius-lb-field)] border border-current/15 bg-current/[0.04] px-2 text-sm text-current outline-none focus:border-lb-accent"
                        />
                      )}
                      <button
                        onClick={() => removeSet(exIdx, setIdx)}
                        className="cursor-pointer text-current/40 transition-colors hover:text-lb-alert"
                        aria-label="Remove set"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addSet(exIdx)}
                    className="mt-1 flex w-fit cursor-pointer items-center gap-1 text-xs font-semibold text-lb-accent hover:underline"
                  >
                    <Plus className="size-3.5" /> Add set
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <TextField label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <Button fullWidth loading={mutation.isPending} disabled={!canSubmit} onClick={() => mutation.mutate()}>
          Assign workout
        </Button>
      </div>
    </Modal>
  );
}
