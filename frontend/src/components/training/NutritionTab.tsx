"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Dumbbell as DumbbellIcon,
  Flame,
  Moon,
  Plus,
  Search,
  Sunrise,
  Trash2,
  Utensils,
  UtensilsCrossed,
  X,
} from "lucide-react";
import {
  addNutritionEntry,
  archiveDietPlan,
  createDietPlan,
  deleteNutritionEntry,
  fetchDietPlanHistory,
  fetchNutritionDay,
  fetchNutritionHistory,
  searchFoods,
} from "@/lib/api/training";
import { DietPlanView, FoodSearchItem, MealType, NutritionEntryInput } from "@/lib/api/types";
import { isoToday, shiftIsoDate } from "@/lib/date";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { BarChart } from "@/components/ui/BarChart";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

const MEAL_TYPES: { value: MealType; label: string; icon: typeof Sunrise }[] = [
  { value: "BREAKFAST", label: "Breakfast", icon: Sunrise },
  { value: "MID_MORNING", label: "Mid-morning", icon: Coffee },
  { value: "LUNCH", label: "Lunch", icon: Utensils },
  { value: "SNACK", label: "Snack", icon: UtensilsCrossed },
  { value: "DINNER", label: "Dinner", icon: Moon },
  { value: "POST_WORKOUT", label: "Post-workout", icon: DumbbellIcon },
];

function formatDateLabel(iso: string): string {
  if (iso === isoToday()) return "Today";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function numOrUndef(v: string): number | undefined {
  const n = Number(v);
  return v.trim() === "" || Number.isNaN(n) ? undefined : n;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function ProgressBar({ value, target, color }: { value: number; target?: number; color: string }) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  const over = target != null && value > target;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-current/10">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: over ? "var(--color-lb-alert)" : color }}
      />
    </div>
  );
}

function Macro({ label, value, target, color }: { label: string; value: number; target?: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold" style={{ color }}>
          {label}
        </span>
        <span className="lb-num text-lb-ink2">
          {value}
          {target ? `/${target}g` : "g"}
        </span>
      </div>
      <div className="mt-1.5">
        <ProgressBar value={value} target={target} color={color} />
      </div>
    </div>
  );
}

export function NutritionTab({ userId }: { userId: string }) {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(isoToday());
  const [addingFood, setAddingFood] = useState<MealType | null>(null);
  const [editingGoal, setEditingGoal] = useState(false);

  const dayQuery = useQuery({ queryKey: ["nutrition-day", userId, date], queryFn: () => fetchNutritionDay(userId, date) });
  const historyQuery = useQuery({ queryKey: ["nutrition-history", userId], queryFn: () => fetchNutritionHistory(userId, 14) });
  const planHistoryQuery = useQuery({ queryKey: ["diet-plan-history", userId], queryFn: () => fetchDietPlanHistory(userId) });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["nutrition-day", userId] });
    queryClient.invalidateQueries({ queryKey: ["nutrition-history", userId] });
  }

  function invalidatePlan() {
    invalidate();
    queryClient.invalidateQueries({ queryKey: ["diet-plan-history", userId] });
  }

  const deleteMutation = useMutation({
    mutationFn: (entryId: string) => deleteNutritionEntry(entryId),
    onSuccess: () => {
      push("success", "Removed.");
      invalidate();
    },
    onError: () => push("error", "Couldn't remove this entry."),
  });

  const waterMutation = useMutation({
    mutationFn: (delta: 500 | -500) =>
      addNutritionEntry(userId, {
        loggedOn: date,
        foodName: "Water",
        servingAmount: 500,
        servingUnit: "ml",
        waterMl: delta,
      }),
    onSuccess: () => invalidate(),
    onError: () => push("error", "Couldn't log water."),
  });

  const archiveMutation = useMutation({
    mutationFn: (planId: string) => archiveDietPlan(userId, planId),
    onSuccess: () => {
      push("success", "Goal archived.");
      invalidatePlan();
    },
    onError: () => push("error", "Couldn't archive this goal."),
  });

  if (dayQuery.isLoading) return <SkeletonRows rows={6} />;
  if (dayQuery.isError) return <ErrorState message="Couldn't load nutrition." onRetry={() => dayQuery.refetch()} />;

  const day = dayQuery.data!;
  const t = day.totals;
  const plan = day.plan;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setDate((d) => shiftIsoDate(d, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-32 text-center text-sm font-semibold">{formatDateLabel(date)}</span>
          <Button size="sm" variant="ghost" disabled={date >= isoToday()} onClick={() => setDate((d) => shiftIsoDate(d, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <Button size="sm" onClick={() => setAddingFood("BREAKFAST")}>
          <Plus className="size-4" /> Add food
        </Button>
      </div>

      <GlassCard raised>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-lb-dim">Calories</p>
            <p className="lb-num mt-1 text-3xl font-extrabold">
              {t.calories}
              <span className="text-base font-medium text-lb-ink2">/{plan?.kcalTarget ?? "—"}</span>
            </p>
          </div>
          <span className="flex size-11 items-center justify-center rounded-full bg-lb-accent/14 text-lb-accent">
            <Flame className="size-5" />
          </span>
        </div>
        <div className="mt-3">
          <ProgressBar value={t.calories} target={plan?.kcalTarget} color="var(--color-lb-accent)" />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Macro label="Protein" value={t.proteinG} target={plan?.proteinG} color="var(--color-lb-good)" />
          <Macro label="Carbs" value={t.carbsG} target={plan?.carbsG} color="var(--color-lb-accent)" />
          <Macro label="Fat" value={t.fatG} target={plan?.fatG} color="#ee8b63" />
          <Macro label="Fiber" value={t.fiberG} target={plan?.fiberGTarget} color="#a78bfa" />
        </div>
      </GlassCard>

      <GlassCard>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-lb-dim">Water</p>
            <p className="lb-num mt-1 text-xl font-bold">
              {t.waterMl} ml <span className="text-sm font-normal text-lb-ink2">/ {plan?.waterMlTarget ?? "—"}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" loading={waterMutation.isPending} onClick={() => waterMutation.mutate(-500)}>
              −500
            </Button>
            <Button size="sm" variant="ghost" loading={waterMutation.isPending} onClick={() => waterMutation.mutate(500)}>
              +500
            </Button>
          </div>
        </div>
        <div className="mt-3">
          <ProgressBar value={t.waterMl} target={plan?.waterMlTarget} color="#59b9ff" />
        </div>
      </GlassCard>

      <GlassCard>
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Nutrition goal</h3>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditingGoal(true)}>
              {plan ? "New version" : "Create goal"}
            </Button>
            {plan && (
              <Button size="sm" variant="subtle" onClick={() => archiveMutation.mutate(plan.id)} loading={archiveMutation.isPending}>
                Archive
              </Button>
            )}
          </div>
        </div>
        {plan ? (
          <>
            <p className="mt-3 font-semibold">{plan.objective}</p>
            {plan.content && <p className="mt-1 text-sm text-lb-ink2">{plan.content}</p>}
          </>
        ) : (
          <div className="mt-3">
            <EmptyState icon={Utensils} title="No active goal" description="Set calorie and macro targets for this member." />
          </div>
        )}
        {planHistoryQuery.data && planHistoryQuery.data.length > 1 && (
          <div className="mt-4 flex flex-col gap-1.5 border-t border-lb-glass-line pt-3">
            {planHistoryQuery.data.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-lb-ink2">{p.objective}</span>
                <Badge tone={p.active ? "good" : "neutral"}>{p.active ? "Active" : "Archived"}</Badge>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <div className="flex flex-col gap-3">
        {MEAL_TYPES.map((mt) => {
          const items = day.entries.filter((e) => e.mealType === mt.value);
          const subtotal = items.reduce((s, e) => s + (e.calories ?? 0), 0);
          return (
            <GlassCard key={mt.value}>
              <button
                onClick={() => setAddingFood(mt.value)}
                className="flex w-full cursor-pointer items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <mt.icon className="size-4 text-lb-dim" />
                  <span className="font-semibold">{mt.label}</span>
                </div>
                <span className="lb-num text-xs text-lb-ink2">
                  {items.length} item{items.length === 1 ? "" : "s"} · {subtotal} kcal
                </span>
              </button>
              {items.length > 0 && (
                <div className="mt-3 flex flex-col gap-1">
                  {items.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded-[var(--radius-lb-field)] px-3 py-2 text-sm hover:bg-lb-glass"
                    >
                      <div>
                        <p>{e.foodName}</p>
                        <p className="text-xs text-lb-ink2">
                          {e.servingAmount} {e.servingUnit} · P{e.proteinG ?? 0} C{e.carbsG ?? 0} F{e.fatG ?? 0}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="lb-num text-xs">{e.calories ?? 0} kcal</span>
                        <button
                          onClick={() => deleteMutation.mutate(e.id)}
                          className="cursor-pointer text-lb-dim transition-colors hover:text-lb-alert"
                          aria-label="Remove entry"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          );
        })}
      </div>

      <GlassCard>
        <h3 className="flex items-center gap-2 font-bold">
          <BarChart3 className="size-4.5 text-lb-accent" /> Last 14 days
        </h3>
        <div className="mt-5">
          {historyQuery.isLoading ? (
            <SkeletonRows rows={2} />
          ) : historyQuery.isError ? (
            <ErrorState message="Couldn't load history." onRetry={() => historyQuery.refetch()} />
          ) : (
            <BarChart
              data={historyQuery.data!.map((d) => ({ label: d.date.slice(5), value: d.totals.calories }))}
              valueLabel="calories"
            />
          )}
        </div>
      </GlassCard>

      {addingFood && (
        <AddFoodModal
          userId={userId}
          date={date}
          defaultMeal={addingFood}
          onClose={() => setAddingFood(null)}
          onSuccess={invalidate}
        />
      )}
      {editingGoal && (
        <GoalModal userId={userId} initial={plan} onClose={() => setEditingGoal(false)} onSuccess={invalidatePlan} />
      )}
    </div>
  );
}

function AddFoodModal({
  userId,
  date,
  defaultMeal,
  onClose,
  onSuccess,
}: {
  userId: string;
  date: string;
  defaultMeal: MealType;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { push } = useToast();
  const [mode, setMode] = useState<"search" | "manual">("search");
  const [mealType, setMealType] = useState<MealType>(defaultMeal);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<FoodSearchItem | null>(null);
  const [servings, setServings] = useState("1");

  const [foodName, setFoodName] = useState("");
  const [servingAmount, setServingAmount] = useState("100");
  const [servingUnit, setServingUnit] = useState("g");
  const [calories, setCalories] = useState("");
  const [proteinG, setProteinG] = useState("");
  const [carbsG, setCarbsG] = useState("");
  const [fatG, setFatG] = useState("");
  const [fiberG, setFiberG] = useState("");

  useEffect(() => {
    if (mode !== "search" || query.trim().length < 2) {
      // Clears stale results the instant the query is emptied/mode switches,
      // rather than waiting on the debounce below.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const handle = setTimeout(() => {
      searchFoods(query)
        .then((r) => {
          if (!cancelled) setResults(r);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, mode]);

  const mutation = useMutation({
    mutationFn: () => {
      let input: NutritionEntryInput;
      if (selected) {
        const multiplier = Number(servings) || 1;
        input = {
          loggedOn: date,
          mealType,
          foodName: selected.name,
          servingAmount: round1(multiplier * (selected.defaultServingGrams || 1)),
          servingUnit: "g",
          calories: Math.round(selected.calories * multiplier),
          proteinG: round1(selected.proteinG * multiplier),
          carbsG: round1(selected.carbsG * multiplier),
          fatG: round1(selected.fatG * multiplier),
          fiberG: round1(selected.fiberG * multiplier),
          source: "USDA",
          sourceRef: selected.sourceRef,
        };
      } else {
        input = {
          loggedOn: date,
          mealType,
          foodName,
          servingAmount: numOrUndef(servingAmount) ?? 1,
          servingUnit,
          calories: numOrUndef(calories),
          proteinG: numOrUndef(proteinG),
          carbsG: numOrUndef(carbsG),
          fatG: numOrUndef(fatG),
          fiberG: numOrUndef(fiberG),
          source: "MANUAL",
        };
      }
      return addNutritionEntry(userId, input);
    },
    onSuccess: () => {
      push("success", "Logged.");
      onSuccess();
      onClose();
    },
    onError: () => push("error", "Couldn't log this food."),
  });

  const canSubmit = mode === "search" ? !!selected : foodName.trim().length > 0;

  return (
    <Modal open onClose={onClose} title="Add food" width="max-w-lg">
      <div className="flex flex-col gap-4">
        <ChipGroup
          label="Meal"
          options={MEAL_TYPES.map((m) => ({ value: m.value, label: m.label }))}
          value={mealType}
          onChange={(v) => setMealType(v as MealType)}
        />

        <ChipGroup
          options={[
            { value: "search", label: "Search" },
            { value: "manual", label: "Manual entry" },
          ]}
          value={mode}
          onChange={(v) => setMode(v as "search" | "manual")}
        />

        {mode === "search" ? (
          <>
            <TextField
              placeholder="Search foods…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
              }}
              leftAdornment={<Search className="size-4" />}
            />
            {searching && <p className="text-xs text-lb-dim">Searching…</p>}
            {!selected && results.length > 0 && (
              <div className="flex max-h-56 flex-col gap-1 overflow-y-auto lb-scrollbar">
                {results.map((r) => (
                  <button
                    key={r.sourceRef}
                    onClick={() => setSelected(r)}
                    className="cursor-pointer rounded-[var(--radius-lb-field)] px-3 py-2 text-left text-sm text-current hover:bg-current/8"
                  >
                    <p className="font-medium">
                      {r.name}
                      {r.brand ? ` · ${r.brand}` : ""}
                    </p>
                    <p className="text-xs text-current/50">
                      {r.servingLabel} · {r.calories} kcal
                    </p>
                  </button>
                ))}
              </div>
            )}
            {!selected && !searching && query.trim().length >= 2 && results.length === 0 && (
              <button
                onClick={() => {
                  setFoodName(query);
                  setMode("manual");
                }}
                className="cursor-pointer text-left text-sm font-semibold text-lb-accent hover:underline"
              >
                Can&apos;t find it? Enter &quot;{query}&quot; manually
              </button>
            )}
            {selected && (
              <div className="rounded-[var(--radius-lb-field)] bg-current/5 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{selected.name}</p>
                  <button onClick={() => setSelected(null)} className="cursor-pointer text-current/50 hover:text-current">
                    <X className="size-4" />
                  </button>
                </div>
                <div className="mt-2 flex items-end gap-3">
                  <TextField
                    label="Servings"
                    type="number"
                    min="0.25"
                    step="0.25"
                    value={servings}
                    onChange={(e) => setServings(e.target.value)}
                    className="w-28"
                  />
                  <p className="pb-3.5 text-xs text-current/60">
                    ≈ {Math.round(selected.calories * (Number(servings) || 1))} kcal
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <TextField label="Food name" required value={foodName} onChange={(e) => setFoodName(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Amount" type="number" value={servingAmount} onChange={(e) => setServingAmount(e.target.value)} />
              <TextField label="Unit" value={servingUnit} onChange={(e) => setServingUnit(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Calories" type="number" value={calories} onChange={(e) => setCalories(e.target.value)} />
              <TextField label="Protein (g)" type="number" value={proteinG} onChange={(e) => setProteinG(e.target.value)} />
              <TextField label="Carbs (g)" type="number" value={carbsG} onChange={(e) => setCarbsG(e.target.value)} />
              <TextField label="Fat (g)" type="number" value={fatG} onChange={(e) => setFatG(e.target.value)} />
            </div>
            <TextField label="Fiber (g)" type="number" value={fiberG} onChange={(e) => setFiberG(e.target.value)} />
          </>
        )}

        <Button fullWidth loading={mutation.isPending} disabled={!canSubmit} onClick={() => mutation.mutate()}>
          Log food
        </Button>
      </div>
    </Modal>
  );
}

function GoalModal({
  userId,
  initial,
  onClose,
  onSuccess,
}: {
  userId: string;
  initial: DietPlanView | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { push } = useToast();
  const [objective, setObjective] = useState(initial?.objective ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [kcalTarget, setKcalTarget] = useState(initial?.kcalTarget?.toString() ?? "");
  const [proteinG, setProteinG] = useState(initial?.proteinG?.toString() ?? "");
  const [carbsG, setCarbsG] = useState(initial?.carbsG?.toString() ?? "");
  const [fatG, setFatG] = useState(initial?.fatG?.toString() ?? "");
  const [fiberGTarget, setFiberGTarget] = useState(initial?.fiberGTarget?.toString() ?? "");
  const [waterMlTarget, setWaterMlTarget] = useState(initial?.waterMlTarget?.toString() ?? "2000");
  const [startsOn, setStartsOn] = useState(isoToday());

  const mutation = useMutation({
    mutationFn: () =>
      createDietPlan(userId, {
        objective,
        content,
        startsOn,
        kcalTarget: numOrUndef(kcalTarget),
        proteinG: numOrUndef(proteinG),
        carbsG: numOrUndef(carbsG),
        fatG: numOrUndef(fatG),
        fiberGTarget: numOrUndef(fiberGTarget),
        waterMlTarget: numOrUndef(waterMlTarget),
      }),
    onSuccess: () => {
      push("success", "Goal saved.");
      onSuccess();
      onClose();
    },
    onError: () => push("error", "Couldn't save this goal."),
  });

  return (
    <Modal open onClose={onClose} title={initial ? "New goal version" : "Create nutrition goal"}>
      <div className="flex flex-col gap-3">
        <TextField label="Objective" placeholder="e.g. Fat loss" required value={objective} onChange={(e) => setObjective(e.target.value)} />
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-current/70">Guidance</span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="w-full rounded-[var(--radius-lb-field)] border border-current/15 bg-current/[0.04] p-3 text-[15px] text-current outline-none focus:border-lb-accent"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Calories" type="number" value={kcalTarget} onChange={(e) => setKcalTarget(e.target.value)} />
          <TextField label="Water (ml)" type="number" value={waterMlTarget} onChange={(e) => setWaterMlTarget(e.target.value)} />
          <TextField label="Protein (g)" type="number" value={proteinG} onChange={(e) => setProteinG(e.target.value)} />
          <TextField label="Carbs (g)" type="number" value={carbsG} onChange={(e) => setCarbsG(e.target.value)} />
          <TextField label="Fat (g)" type="number" value={fatG} onChange={(e) => setFatG(e.target.value)} />
          <TextField label="Fiber (g)" type="number" value={fiberGTarget} onChange={(e) => setFiberGTarget(e.target.value)} />
        </div>
        <TextField label="Starts on" type="date" required value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
        <Button fullWidth loading={mutation.isPending} disabled={!objective || !content} onClick={() => mutation.mutate()}>
          Save goal
        </Button>
      </div>
    </Modal>
  );
}
