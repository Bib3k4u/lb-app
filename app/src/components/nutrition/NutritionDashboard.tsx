import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { Button, GlassCard, SearchableSelect, TextField } from "../ui";
import { api, problemFrom } from "../../lib/api/client";
import type {
  DietPlan,
  FoodSearchItem,
  MealType,
  NutritionDay,
  NutritionEntry,
  NutritionHistoryDay,
} from "../../lib/training/nutrition";
import { colors, radius, spacing, typography } from "../../lib/theme";
import indianFoodData from "../../data/indian_foods_nutrition_100g.json";
import { NutritionTrendChart } from "./NutritionTrendChart";

const meals: {
  value: MealType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: "BREAKFAST", label: "Breakfast", icon: "sunny-outline" },
  { value: "MID_MORNING", label: "Mid-morning", icon: "cafe-outline" },
  { value: "LUNCH", label: "Lunch", icon: "restaurant-outline" },
  { value: "SNACK", label: "Snack", icon: "nutrition-outline" },
  { value: "DINNER", label: "Dinner", icon: "moon-outline" },
  { value: "POST_WORKOUT", label: "Post-workout", icon: "barbell-outline" },
];
const emptyFood = {
  name: "",
  amount: "100",
  unit: "g",
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
  fiber: "",
  notes: "",
  meal: "BREAKFAST" as MealType,
  source: "MANUAL",
  sourceRef: "",
};
const emptyPlan = {
  objective: "Muscle gain",
  content:
    "Prioritise minimally processed foods, consistent protein across meals, fruit and vegetables, and hydration.",
  kcal: "",
  protein: "",
  carbs: "",
  fat: "",
  fiber: "30",
  water: "2500",
};
type SearchFood = FoodSearchItem & {
  origin: "USDA" | "INDIAN_DATASET";
  category?: string;
  confidence?: string;
};
type FoodSelection = { item: SearchFood; amount: string; meal: MealType };
type IndianFood = {
  id: string;
  name: string;
  category: string;
  region: string;
  basis: { amount: number; unit: string; state: string };
  nutrition_per_100g: {
    calories_kcal: number;
    protein_g: number;
    carbohydrates_g: number;
    fat_g: number;
    fibre_g: number;
  };
  value_type: string;
  confidence: string;
};

export function NutritionDashboard({
  userId,
  memberName,
  canManageGoals = false,
  onBack,
}: {
  userId?: string | undefined;
  memberName?: string | undefined;
  canManageGoals?: boolean;
  onBack?: () => void;
}) {
  const qc = useQueryClient();
  const owner = userId ?? "me";
  const base = userId ? `/users/${userId}` : "/me";
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [openMeals, setOpenMeals] = useState<Set<MealType>>(() => new Set());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [foodOpen, setFoodOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [food, setFood] = useState(emptyFood);
  const [foodSearch, setFoodSearch] = useState("");
  const [selectedFoods, setSelectedFoods] = useState<FoodSelection[]>([]);
  const [plan, setPlan] = useState(emptyPlan);
  const [selectedPlanPresetId, setSelectedPlanPresetId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [waterLocked, setWaterLocked] = useState(false);
  const [historyView, setHistoryView] = useState<"chart" | "bars">("chart");
  const planScrollRef = useRef<ScrollViewInstance>(null);
  const planFormY = useRef(0);
  const queryKey = ["nutrition", owner, date] as const;
  const day = useQuery({
    queryKey,
    queryFn: async () =>
      (await api.get<NutritionDay>(`${base}/nutrition`, { params: { date } }))
        .data,
  });
  const history = useQuery({
    queryKey: ["nutrition", owner, "history"],
    queryFn: async () =>
      (
        await api.get<NutritionHistoryDay[]>(`${base}/nutrition/history`, {
          params: { days: 14 },
        })
      ).data,
  });
  const planHistory = useQuery({
    queryKey: ["nutrition", owner, "plans"],
    queryFn: async () =>
      (await api.get<DietPlan[]>(`${base}/diet-plans/history`)).data,
    enabled: canManageGoals,
  });
  const foods = useQuery({
    queryKey: ["nutrition", "food-search", foodSearch],
    queryFn: async () =>
      (
        await api.get<FoodSearchItem[]>("/nutrition/foods/search", {
          params: { q: foodSearch.trim() },
        })
      ).data,
    enabled: foodOpen && foodSearch.trim().length >= 2,
    staleTime: 300000,
  });
  const indianFoods = useMemo<SearchFood[]>(() => {
    const query = normaliseSearch(foodSearch);
    if (query.length < 2) return [];
    const tokens = query.split(" ").filter(Boolean);
    return (indianFoodData.foods as IndianFood[])
      .map((item) => {
        const name = normaliseSearch(item.name);
        const searchable = `${name} ${normaliseSearch(item.category)} ${normaliseSearch(item.region)}`;
        const score =
          name === query
            ? 100
            : name.startsWith(query)
              ? 80
              : name.includes(query)
                ? 60
                : tokens.every((token) => searchable.includes(token))
                  ? 40
                  : 0;
        return { item, score };
      })
      .filter((match) => match.score > 0)
      .sort(
        (a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name),
      )
      .slice(0, 6)
      .map(({ item }) => ({
        sourceRef: item.id,
        name: item.name,
        brand: null,
        servingLabel: `${item.basis.amount} ${item.basis.unit} · ${item.basis.state}`,
        defaultServingGrams: item.basis.amount,
        calories: item.nutrition_per_100g.calories_kcal,
        proteinG: item.nutrition_per_100g.protein_g,
        carbsG: item.nutrition_per_100g.carbohydrates_g,
        fatG: item.nutrition_per_100g.fat_g,
        fiberG: item.nutrition_per_100g.fibre_g,
        origin: "INDIAN_DATASET",
        category: item.category,
        confidence: item.confidence,
      }));
  }, [foodSearch]);
  const searchResults = useMemo<SearchFood[]>(
    () =>
      [
        ...indianFoods,
        ...(foods.data ?? []).map((item) => ({
          ...item,
          origin: "USDA" as const,
        })),
      ].slice(0, 10),
    [indianFoods, foods.data],
  );
  function refresh() {
    void qc.invalidateQueries({ queryKey: ["nutrition", owner] });
  }
  function payload() {
    return {
      loggedOn: date,
      mealType: food.meal,
      foodName: food.name.trim(),
      servingAmount: Number(food.amount),
      servingUnit: food.unit.trim(),
      calories: Number(food.calories || 0),
      proteinG: Number(food.protein || 0),
      carbsG: Number(food.carbs || 0),
      fatG: Number(food.fat || 0),
      fiberG: Number(food.fiber || 0),
      waterMl: 0,
      source: food.source,
      sourceRef: food.sourceRef || null,
      notes: food.notes.trim() || null,
    };
  }
  function selectedPayload(selection: FoodSelection) {
    const factor = Number(selection.amount || 0) / 100;
    const item = selection.item;
    return {
      loggedOn: date,
      mealType: selection.meal,
      foodName: item.name,
      servingAmount: Number(selection.amount),
      servingUnit: "g",
      calories: item.calories * factor,
      proteinG: item.proteinG * factor,
      carbsG: item.carbsG * factor,
      fatG: item.fatG * factor,
      fiberG: item.fiberG * factor,
      waterMl: 0,
      source: item.origin === "USDA" ? "USDA" : "MANUAL",
      sourceRef: item.sourceRef,
      notes:
        item.origin === "INDIAN_DATASET"
          ? `Indian food dataset estimate · ${item.confidence ?? "medium"} confidence`
          : null,
    };
  }
  const saveFood = useMutation({
    mutationFn: async () => {
      if (editing) return api.put(`/nutrition/entries/${editing}`, payload());
      if (selectedFoods.length)
        return api.post(
          `${base}/nutrition/entries/batch`,
          selectedFoods.map(selectedPayload),
        );
      return api.post(`${base}/nutrition/entries`, payload());
    },
    onSuccess: () => {
      refresh();
      setFoodOpen(false);
      setFood(emptyFood);
      setEditing(null);
      setSelectedFoods([]);
      setFoodSearch("");
    },
    onError: (e) =>
      setError(problemFrom(e).detail ?? "Could not save this food."),
  });
  const water = useMutation({
    mutationFn: (ml: number) =>
      api.post(`${base}/nutrition/entries`, {
        loggedOn: date,
        mealType: null,
        foodName: "Water",
        servingAmount: Math.abs(ml),
        servingUnit: "ml",
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        fiberG: 0,
        waterMl: ml,
        source: "MANUAL",
      }),
    onMutate: () => {
      setWaterLocked(true);
      setTimeout(() => setWaterLocked(false), 3000);
    },
    onSuccess: refresh,
    onError: (e) =>
      Alert.alert("Could not update water", problemFrom(e).detail),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/nutrition/entries/${id}`),
    onSuccess: refresh,
    onError: (e) =>
      Alert.alert("Could not delete entry", problemFrom(e).detail),
  });
  const savePlan = useMutation({
    mutationFn: () =>
      api.post(`${base}/diet-plans`, {
        objective: plan.objective.trim(),
        content: plan.content.trim(),
        kcalTarget: nullable(plan.kcal),
        proteinG: nullable(plan.protein),
        carbsG: nullable(plan.carbs),
        fatG: nullable(plan.fat),
        fiberGTarget: nullable(plan.fiber),
        waterMlTarget: nullable(plan.water),
        startsOn: date,
        endsOn: null,
      }),
    onSuccess: () => {
      refresh();
      void qc.invalidateQueries({ queryKey: ["nutrition", owner, "plans"] });
      setPlanOpen(false);
    },
    onError: (e) =>
      setError(problemFrom(e).detail ?? "Could not save nutrition goals."),
  });
  const deactivate = useMutation({
    mutationFn: (id: string) => api.delete(`${base}/diet-plans/${id}`),
    onSuccess: () => {
      refresh();
      void qc.invalidateQueries({ queryKey: ["nutrition", owner, "plans"] });
    },
    onError: (e) =>
      Alert.alert("Could not archive plan", problemFrom(e).detail),
  });
  const grouped = useMemo(
    () =>
      new Map(
        meals.map((meal) => [
          meal.value,
          (day.data?.entries ?? []).filter(
            (entry) => entry.mealType === meal.value && entry.waterMl === 0,
          ),
        ]),
      ),
    [day.data?.entries],
  );
  const currentPlan = day.data?.plan;
  const totals = day.data?.totals;
  const macroKcal =
    Number(plan.protein || 0) * 4 +
    Number(plan.carbs || 0) * 4 +
    Number(plan.fat || 0) * 9;
  const caloriesExceeded =
    currentPlan?.kcalTarget != null &&
    (totals?.calories ?? 0) > currentPlan.kcalTarget;
  const waterExceeded = (totals?.waterMl ?? 0) > 5000;
  function selectFood(raw: SearchFood) {
    const item = {
      ...raw,
      sourceRef: String(raw.sourceRef),
      defaultServingGrams: Number(raw.defaultServingGrams) || 100,
      calories: Number(raw.calories) || 0,
      proteinG: Number(raw.proteinG) || 0,
      carbsG: Number(raw.carbsG) || 0,
      fatG: Number(raw.fatG) || 0,
      fiberG: Number(raw.fiberG) || 0,
    };
    setSelectedFoods((old) =>
      old.some((selection) => selection.item.sourceRef === item.sourceRef)
        ? old
        : [
            ...old,
            { item, amount: String(item.defaultServingGrams), meal: food.meal },
          ],
    );
    setFoodSearch("");
  }
  function editEntry(entry: NutritionEntry) {
    setEditing(entry.id);
    setSelectedFoods([]);
    setFood({
      name: entry.foodName,
      amount: String(entry.servingAmount),
      unit: entry.servingUnit,
      calories: String(entry.calories),
      protein: String(entry.proteinG),
      carbs: String(entry.carbsG),
      fat: String(entry.fatG),
      fiber: String(entry.fiberG),
      notes: entry.notes ?? "",
      meal: entry.mealType ?? "SNACK",
      source: entry.source,
      sourceRef: entry.sourceRef ?? "",
    });
    setFoodOpen(true);
  }
  function openPlan() {
    const p = currentPlan;
    setPlan(
      p
        ? {
            objective: p.objective,
            content: p.content,
            kcal: String(p.kcalTarget ?? ""),
            protein: String(p.proteinG ?? ""),
            carbs: String(p.carbsG ?? ""),
            fat: String(p.fatG ?? ""),
            fiber: String(p.fiberGTarget ?? ""),
            water: String(p.waterMlTarget ?? ""),
          }
        : emptyPlan,
    );
    setPlanOpen(true);
    setSelectedPlanPresetId(p?.id ?? "");
    setError(null);
  }
  function applyPlanPreset(item: DietPlan) {
    setSelectedPlanPresetId(item.id);
    setPlan({
      objective: item.objective,
      content: item.content,
      kcal: String(item.kcalTarget ?? ""),
      protein: String(item.proteinG ?? ""),
      carbs: String(item.carbsG ?? ""),
      fat: String(item.fatG ?? ""),
      fiber: String(item.fiberGTarget ?? ""),
      water: String(item.waterMlTarget ?? ""),
    });
    setError(null);
    requestAnimationFrame(() => {
      planScrollRef.current?.scrollTo({
        y: Math.max(0, planFormY.current - spacing.sm),
        animated: true,
      });
    });
  }
  return (
    <View style={s.content}>
      <View style={s.header}>
        {onBack ? (
          <Pressable style={s.back} onPress={onBack}>
            <Ionicons name="arrow-back" size={20} color={colors.ink} />
          </Pressable>
        ) : null}
        <View style={s.grow}>
          <Text style={s.eyebrow}>DAILY NUTRITION</Text>
          <Text style={s.title}>
            {memberName ? `${memberName}'s nutrition` : "Fuel your progress"}
          </Text>
          <Text style={s.muted}>
            Food, macros and hydration in one daily diary
          </Text>
        </View>
        <Pressable
          style={s.add}
          onPress={() => {
            setFood(emptyFood);
            setEditing(null);
            setSelectedFoods([]);
            setFoodOpen(true);
          }}
        >
          <Ionicons name="add" size={23} color={colors.onAccent} />
        </Pressable>
      </View>
      <View style={s.dateNav}>
        <Pressable
          style={s.dateArrow}
          onPress={() =>
            setDate(
              format(addDays(new Date(`${date}T00:00:00`), -1), "yyyy-MM-dd"),
            )
          }
        >
          <Ionicons name="chevron-back" size={19} color={colors.ink2} />
        </Pressable>
        <Pressable style={s.dateCopy} onPress={() => setDatePickerOpen(true)}>
          <Text style={s.dateTitle}>
            {date === format(new Date(), "yyyy-MM-dd")
              ? "Today"
              : format(new Date(`${date}T00:00:00`), "EEEE")}
          </Text>
          <View style={s.datePickerLabel}>
            <Text style={s.muted}>
              {format(new Date(`${date}T00:00:00`), "d MMMM yyyy")}
            </Text>
            <Ionicons name="calendar-outline" size={14} color={colors.accent} />
          </View>
        </Pressable>
        <Pressable
          disabled={date >= format(new Date(), "yyyy-MM-dd")}
          style={[
            s.dateArrow,
            date >= format(new Date(), "yyyy-MM-dd") && s.disabled,
          ]}
          onPress={() =>
            setDate(
              format(addDays(new Date(`${date}T00:00:00`), 1), "yyyy-MM-dd"),
            )
          }
        >
          <Ionicons name="chevron-forward" size={19} color={colors.ink2} />
        </Pressable>
      </View>
      {Platform.OS === "android" && datePickerOpen ? (
        <DateTimePicker
          value={new Date(`${date}T00:00:00`)}
          mode="date"
          maximumDate={new Date()}
          display="default"
          themeVariant="dark"
          onChange={(_, next) => {
            setDatePickerOpen(false);
            if (next) setDate(format(next, "yyyy-MM-dd"));
          }}
        />
      ) : null}
      {Platform.OS === "ios" ? (
        <Modal
          visible={datePickerOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setDatePickerOpen(false)}
        >
          <View style={s.overlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setDatePickerOpen(false)}
            />
            <View style={s.dateSheet}>
              <View style={s.sheetHeader}>
                <View>
                  <Text style={s.sheetTitle}>Intake date</Text>
                  <Text style={s.muted}>View the full diary for any day</Text>
                </View>
                <Pressable
                  style={s.dateDone}
                  onPress={() => setDatePickerOpen(false)}
                >
                  <Text style={s.dateDoneText}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={new Date(`${date}T00:00:00`)}
                mode="date"
                maximumDate={new Date()}
                display="spinner"
                themeVariant="dark"
                onChange={(_, next) => {
                  if (next) setDate(format(next, "yyyy-MM-dd"));
                }}
              />
            </View>
          </View>
        </Modal>
      ) : null}
      {day.isPending ? (
        <GlassCard style={s.loading}>
          <ActivityIndicator color={colors.accent} />
          <Text style={s.muted}>Loading diary…</Text>
        </GlassCard>
      ) : day.isError ? (
        <GlassCard style={s.loading}>
          <Text style={s.error}>
            {problemFrom(day.error).detail ?? "Could not load nutrition."}
          </Text>
          <Button
            label="Retry"
            variant="ghost"
            onPress={() => void day.refetch()}
          />
        </GlassCard>
      ) : (
        <>
          <GlassCard style={s.hero} raised>
            <View style={s.heroTop}>
              <View>
                <Text style={s.heroLabel}>CALORIES</Text>
                <Text style={[s.heroValue, caloriesExceeded && s.dangerText]}>
                  {round(totals?.calories)}{" "}
                  <Text style={s.heroTarget}>
                    / {currentPlan?.kcalTarget ?? "—"} kcal
                  </Text>
                </Text>
              </View>
              <View style={s.heroIcon}>
                <Ionicons name="flame" size={23} color={colors.onAccent} />
              </View>
            </View>
            <Progress
              value={totals?.calories ?? 0}
              target={currentPlan?.kcalTarget}
              danger={caloriesExceeded}
            />
            <View style={s.macroGrid}>
              <Macro
                label="Protein"
                value={totals?.proteinG}
                target={currentPlan?.proteinG}
                color={colors.good}
              />
              <Macro
                label="Carbs"
                value={totals?.carbsG}
                target={currentPlan?.carbsG}
                color={colors.accent}
              />
              <Macro
                label="Fat"
                value={totals?.fatG}
                target={currentPlan?.fatG}
                color="#ee8b63"
              />
              <Macro
                label="Fibre"
                value={totals?.fiberG}
                target={currentPlan?.fiberGTarget}
                color="#a78bfa"
              />
            </View>
          </GlassCard>
          <GlassCard style={s.waterCard}>
            <View style={s.waterHeader}>
              <View>
                <Text style={s.cardTitle}>Hydration</Text>
                <Text style={s.muted}>Adjust water in 500 ml bottles</Text>
              </View>
              <Text style={[s.waterTotal, waterExceeded && s.dangerText]}>
                {totals?.waterMl ?? 0}{" "}
                <Text style={s.muted}>
                  / {currentPlan?.waterMlTarget ?? "—"} ml
                </Text>
              </Text>
            </View>
            <View style={s.waterControls}>
              <WaterBottle
                amount={-500}
                disabled={
                  waterLocked || water.isPending || (totals?.waterMl ?? 0) < 500
                }
                onPress={() => water.mutate(-500)}
              />
              <View style={s.waterProgress}>
                <Progress
                  value={totals?.waterMl ?? 0}
                  target={currentPlan?.waterMlTarget ?? 5000}
                  blue
                  danger={waterExceeded}
                />
                <Text style={[s.waterHint, waterExceeded && s.dangerText]}>
                  {waterExceeded
                    ? "Above the recommended 5 L daily limit"
                    : waterLocked
                      ? "Water updated · ready again in 3 seconds"
                      : "Use −500 or +500 to adjust"}
                </Text>
              </View>
              <WaterBottle
                amount={500}
                disabled={waterLocked || water.isPending}
                onPress={() => water.mutate(500)}
              />
            </View>
          </GlassCard>
          {currentPlan ? (
            <GlassCard style={s.planCard}>
              <View style={s.planTop}>
                <View style={s.planIcon}>
                  <Ionicons
                    name="compass-outline"
                    size={19}
                    color={colors.accent}
                  />
                </View>
                <View style={s.grow}>
                  <Text style={s.eyebrow}>CURRENT GOAL</Text>
                  <Text style={s.cardTitle}>{currentPlan.objective}</Text>
                </View>
                {canManageGoals ? (
                  <Pressable onPress={openPlan}>
                    <Text style={s.link}>Edit</Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={s.planText}>{currentPlan.content}</Text>
            </GlassCard>
          ) : (
            <GlassCard style={s.empty}>
              <Ionicons
                name="compass-outline"
                size={25}
                color={colors.accent}
              />
              <View style={s.grow}>
                <Text style={s.cardTitle}>No nutrition goals yet</Text>
                <Text style={s.muted}>
                  {canManageGoals
                    ? "Create calorie, macro and hydration targets."
                    : "Your trainer can create goals tailored to your objective."}
                </Text>
              </View>
              {canManageGoals ? (
                <Pressable onPress={openPlan}>
                  <Text style={s.link}>Create</Text>
                </Pressable>
              ) : null}
            </GlassCard>
          )}
          <View style={s.sectionHeader}>
            <View>
              <Text style={s.sectionTitle}>Meals</Text>
              <Text style={s.muted}>
                {
                  (day.data?.entries ?? []).filter((e) => e.waterMl === 0)
                    .length
                }{" "}
                items logged
              </Text>
            </View>
            <Pressable
              style={s.smallAdd}
              onPress={() => {
                setFood(emptyFood);
                setEditing(null);
                setSelectedFoods([]);
                setFoodOpen(true);
              }}
            >
              <Ionicons name="add" size={16} color={colors.accent} />
              <Text style={s.link}>Add food</Text>
            </Pressable>
          </View>
          {meals.map((meal) => {
            const entries = grouped.get(meal.value) ?? [];
            const isOpen = openMeals.has(meal.value);
            return (
              <GlassCard key={meal.value} style={s.mealCard}>
                <View style={s.mealHeader}>
                  <Pressable
                    style={s.mealToggle}
                    onPress={() =>
                      setOpenMeals((current) => {
                        const next = new Set(current);
                        if (next.has(meal.value)) next.delete(meal.value);
                        else next.add(meal.value);
                        return next;
                      })
                    }
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isOpen }}
                    accessibilityLabel={`${isOpen ? "Collapse" : "Expand"} ${meal.label}`}
                  >
                    <View style={s.mealIcon}>
                      <Ionicons
                        name={meal.icon}
                        size={18}
                        color={colors.accent}
                      />
                    </View>
                    <View style={s.grow}>
                      <Text style={s.cardTitle}>{meal.label}</Text>
                      <Text style={s.muted}>
                        {entries.length}{" "}
                        {entries.length === 1 ? "item" : "items"} ·{" "}
                        {round(entries.reduce((sum, e) => sum + e.calories, 0))}{" "}
                        kcal
                      </Text>
                    </View>
                    <Ionicons
                      name={isOpen ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={colors.dim}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setFood({ ...emptyFood, meal: meal.value });
                      setEditing(null);
                      setSelectedFoods([]);
                      setFoodOpen(true);
                    }}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={22}
                      color={colors.accent}
                    />
                  </Pressable>
                </View>
                {isOpen && entries.length ? (
                  entries.map((entry) => (
                    <Pressable
                      key={entry.id}
                      style={s.foodRow}
                      onPress={() => editEntry(entry)}
                    >
                      <View style={s.grow}>
                        <Text style={s.foodName}>{entry.foodName}</Text>
                        <Text style={s.muted}>
                          {entry.servingAmount} {entry.servingUnit} · P{" "}
                          {round(entry.proteinG)}g · C {round(entry.carbsG)}g ·
                          F {round(entry.fatG)}g
                        </Text>
                      </View>
                      <Text style={s.foodKcal}>{round(entry.calories)}</Text>
                      <Pressable
                        hitSlop={8}
                        onPress={() =>
                          Alert.alert("Delete food?", entry.foodName, [
                            { text: "Cancel" },
                            {
                              text: "Delete",
                              style: "destructive",
                              onPress: () => remove.mutate(entry.id),
                            },
                          ])
                        }
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color={colors.alert}
                        />
                      </Pressable>
                    </Pressable>
                  ))
                ) : isOpen ? (
                  <Text style={s.mealEmpty}>Nothing logged</Text>
                ) : null}
              </GlassCard>
            );
          })}
          <View style={s.sectionHeader}>
            <View>
              <Text style={s.sectionTitle}>14-day history</Text>
              <Text style={s.muted}>Calories, protein and water by day</Text>
            </View>
            <View style={s.historyToggle}>
              <Pressable
                style={[
                  s.historyToggleButton,
                  historyView === "chart" && s.historyToggleActive,
                ]}
                onPress={() => setHistoryView("chart")}
              >
                <Ionicons
                  name="analytics-outline"
                  size={14}
                  color={historyView === "chart" ? colors.onAccent : colors.dim}
                />
              </Pressable>
              <Pressable
                style={[
                  s.historyToggleButton,
                  historyView === "bars" && s.historyToggleActive,
                ]}
                onPress={() => setHistoryView("bars")}
              >
                <Ionicons
                  name="list-outline"
                  size={14}
                  color={historyView === "bars" ? colors.onAccent : colors.dim}
                />
              </Pressable>
            </View>
          </View>
          {historyView === "chart" ? (
            <NutritionTrendChart
              days={(history.data ?? []).slice(-14)}
              calorieTarget={currentPlan?.kcalTarget}
              proteinTarget={currentPlan?.proteinG}
              waterTarget={currentPlan?.waterMlTarget}
              onOpenDay={setDate}
            />
          ) : (
            <GlassCard style={s.historyCard}>
              {(history.data ?? []).slice(-14).map((item) => (
                <CalorieHistoryRow
                  key={item.date}
                  item={item}
                  target={currentPlan?.kcalTarget}
                />
              ))}
            </GlassCard>
          )}
          {canManageGoals && (planHistory.data?.length ?? 0) > 1 ? (
            <GlassCard style={s.planHistory}>
              <Text style={s.cardTitle}>Goal history</Text>
              {planHistory.data!.map((item) => (
                <View key={item.id} style={s.planHistoryRow}>
                  <View style={s.grow}>
                    <Text style={s.foodName}>{item.objective}</Text>
                    <Text style={s.muted}>
                      {format(
                        new Date(`${item.startsOn}T00:00:00`),
                        "d MMM yyyy",
                      )}{" "}
                      · {item.kcalTarget ?? "—"} kcal
                    </Text>
                  </View>
                  <Text style={[s.state, item.active && s.stateActive]}>
                    {item.active ? "ACTIVE" : "ARCHIVED"}
                  </Text>
                </View>
              ))}
            </GlassCard>
          ) : null}
        </>
      )}
      <Modal
        visible={foodOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFoodOpen(false)}
      >
        <KeyboardAvoidingView
          style={s.overlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setFoodOpen(false)}
          />
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <View>
                <Text style={s.sheetTitle}>
                  {editing ? "Edit food" : "Log foods"}
                </Text>
                <Text style={s.muted}>
                  {selectedFoods.length
                    ? `${selectedFoods.length} food${selectedFoods.length === 1 ? "" : "s"} selected · add more or review portions`
                    : "Search Indian foods and USDA, or enter manually"}
                </Text>
              </View>
              <Pressable onPress={() => setFoodOpen(false)}>
                <Ionicons name="close" size={21} color={colors.ink2} />
              </Pressable>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.sheetContent}
              keyboardShouldPersistTaps="handled"
            >
              {!editing ? (
                <>
                  <TextField
                    label="Search foods"
                    value={foodSearch}
                    onChangeText={setFoodSearch}
                    placeholder="Roti, dal, chicken breast…"
                  />
                  {foods.isFetching ? (
                    <ActivityIndicator color={colors.accent} />
                  ) : null}
                  {foods.isError ? (
                    <Text style={s.error}>
                      {problemFrom(foods.error).detail ??
                        "USDA search is unavailable. Indian foods and manual entry still work."}
                    </Text>
                  ) : null}
                  {searchResults.map((item) => {
                    const added = selectedFoods.some(
                      (selection) =>
                        selection.item.sourceRef === item.sourceRef,
                    );
                    return (
                      <Pressable
                        key={`${item.origin}-${item.sourceRef}`}
                        disabled={added}
                        style={[s.searchResult, added && s.selectedResult]}
                        onPress={() => selectFood(item)}
                      >
                        <View
                          style={[
                            s.sourceBadge,
                            item.origin === "INDIAN_DATASET" &&
                              s.sourceBadgeIndian,
                          ]}
                        >
                          <Text style={s.sourceBadgeText}>
                            {item.origin === "INDIAN_DATASET" ? "IND" : "USDA"}
                          </Text>
                        </View>
                        <View style={s.grow}>
                          <Text style={s.foodName}>{item.name}</Text>
                          <Text style={s.muted}>
                            {item.origin === "INDIAN_DATASET"
                              ? `${item.category ?? "Indian food"} · ${item.confidence ?? "medium"} estimate · `
                              : item.brand
                                ? `${item.brand} · `
                                : ""}
                            {round(item.calories)} kcal / 100 g
                          </Text>
                        </View>
                        <Text style={s.resultAction}>
                          {added ? "ADDED" : "ADD"}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {foodSearch.trim().length >= 2 &&
                  !foods.isFetching &&
                  !searchResults.length ? (
                    <Pressable
                      style={s.manualHint}
                      onPress={() => {
                        setFood((old) => ({
                          ...old,
                          name: foodSearch.trim(),
                        }));
                        setFoodSearch("");
                      }}
                    >
                      <Ionicons
                        name="create-outline"
                        size={18}
                        color={colors.accent}
                      />
                      <Text style={[s.muted, s.grow]}>
                        No match found. Tap here to enter “{foodSearch.trim()}”
                        and its nutrition manually.
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={colors.accent}
                      />
                    </Pressable>
                  ) : null}
                </>
              ) : null}
              {selectedFoods.length ? (
                selectedFoods.map((selection) => (
                  <FoodSelectionCard
                    key={selection.item.sourceRef}
                    selection={selection}
                    onChange={(change) =>
                      setSelectedFoods((old) =>
                        old.map((current) =>
                          current.item.sourceRef === selection.item.sourceRef
                            ? { ...current, ...change }
                            : current,
                        ),
                      )
                    }
                    onRemove={() =>
                      setSelectedFoods((old) =>
                        old.filter(
                          (current) =>
                            current.item.sourceRef !== selection.item.sourceRef,
                        ),
                      )
                    }
                  />
                ))
              ) : (
                <>
                  <SearchableSelect
                    compact
                    label="Meal"
                    value={
                      meals.find((m) => m.value === food.meal)?.label ?? ""
                    }
                    options={meals.map((m) => m.label)}
                    onSelect={(label) =>
                      setFood((old) => ({
                        ...old,
                        meal:
                          meals.find((m) => m.label === label)?.value ??
                          "SNACK",
                      }))
                    }
                  />
                  <TextField
                    label="Food name"
                    value={food.name}
                    onChangeText={(name) =>
                      setFood((old) => ({ ...old, name }))
                    }
                    placeholder="Food or dish"
                  />
                  <View style={s.two}>
                    <TextField
                      containerStyle={s.grow}
                      label="Serving amount"
                      value={food.amount}
                      onChangeText={(amount) =>
                        setFood((old) => ({ ...old, amount }))
                      }
                      keyboardType="decimal-pad"
                    />
                    <TextField
                      containerStyle={s.grow}
                      label="Unit"
                      value={food.unit}
                      onChangeText={(unit) =>
                        setFood((old) => ({ ...old, unit }))
                      }
                    />
                  </View>
                  <View style={s.two}>
                    <TextField
                      containerStyle={s.grow}
                      label="Calories"
                      value={food.calories}
                      onChangeText={(calories) =>
                        setFood((old) => ({ ...old, calories }))
                      }
                      keyboardType="decimal-pad"
                    />
                    <TextField
                      containerStyle={s.grow}
                      label="Protein (g)"
                      value={food.protein}
                      onChangeText={(protein) =>
                        setFood((old) => ({ ...old, protein }))
                      }
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={s.two}>
                    <TextField
                      containerStyle={s.grow}
                      label="Carbs (g)"
                      value={food.carbs}
                      onChangeText={(carbs) =>
                        setFood((old) => ({ ...old, carbs }))
                      }
                      keyboardType="decimal-pad"
                    />
                    <TextField
                      containerStyle={s.grow}
                      label="Fat (g)"
                      value={food.fat}
                      onChangeText={(fat) =>
                        setFood((old) => ({ ...old, fat }))
                      }
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <TextField
                    label="Fibre (g)"
                    value={food.fiber}
                    onChangeText={(fiber) =>
                      setFood((old) => ({ ...old, fiber }))
                    }
                    keyboardType="decimal-pad"
                  />
                  <TextField
                    label="Note"
                    value={food.notes}
                    onChangeText={(notes) =>
                      setFood((old) => ({ ...old, notes }))
                    }
                    placeholder="Optional"
                  />
                </>
              )}
              {error ? <Text style={s.error}>{error}</Text> : null}
              <Button
                label={
                  editing
                    ? "Save changes"
                    : selectedFoods.length
                      ? `Add ${selectedFoods.length} food${selectedFoods.length === 1 ? "" : "s"} to diary`
                      : "Add to diary"
                }
                loading={saveFood.isPending}
                disabled={
                  selectedFoods.length
                    ? selectedFoods.some(
                        (selection) => Number(selection.amount) <= 0,
                      )
                    : !food.name.trim() || Number(food.amount) <= 0
                }
                onPress={() => {
                  setError(null);
                  saveFood.mutate();
                }}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal
        visible={planOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPlanOpen(false)}
      >
        <KeyboardAvoidingView
          style={s.overlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPlanOpen(false)}
          />
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <View>
                <Text style={s.sheetTitle}>Nutrition goals</Text>
                <Text style={s.muted}>
                  Effective from{" "}
                  {format(new Date(`${date}T00:00:00`), "d MMMM yyyy")}
                </Text>
              </View>
              <Pressable onPress={() => setPlanOpen(false)}>
                <Ionicons name="close" size={21} color={colors.ink2} />
              </Pressable>
            </View>
            <ScrollView
              ref={planScrollRef}
              style={s.planScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.sheetContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={
                Platform.OS === "ios" ? "interactive" : "on-drag"
              }
              automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
            >
              {(planHistory.data?.length ?? 0) > 0 ? (
                <View style={s.goalPresets}>
                  <SearchableSelect
                    compact
                    label="Reuse a previous goal"
                    value={
                      planHistory.data
                        ?.filter((item) => item.id === selectedPlanPresetId)
                        .map(planPresetLabel)[0] ?? ""
                    }
                    options={planHistory.data!.map(planPresetLabel)}
                    placeholder="Select a saved goal"
                    searchPlaceholder="Search previous goals…"
                    onSelect={(label) => {
                      const selected = planHistory.data!.find(
                        (item) => planPresetLabel(item) === label,
                      );
                      if (selected) applyPlanPreset(selected);
                    }}
                  />
                  <Text style={s.muted}>
                    Selecting a saved goal fills the form below. You can still
                    change any value before saving.
                  </Text>
                </View>
              ) : null}
              <View
                style={s.goalForm}
                onLayout={(event) => {
                  planFormY.current = event.nativeEvent.layout.y;
                }}
              >
                <SearchableSelect
                  compact
                  label="Goal"
                  value={plan.objective}
                  options={[
                    "Muscle gain",
                    "Fat loss",
                    "Maintain weight",
                    "Improve performance",
                    "General wellbeing",
                  ]}
                  onSelect={(objective) =>
                    setPlan((old) => ({ ...old, objective }))
                  }
                />
                <TextField
                  label="Daily guidance"
                  value={plan.content}
                  onChangeText={(content) =>
                    setPlan((old) => ({ ...old, content }))
                  }
                  multiline
                />
                <View style={s.two}>
                  <TextField
                    containerStyle={s.grow}
                    label="Calories"
                    value={plan.kcal}
                    onChangeText={(kcal) =>
                      setPlan((old) => ({ ...old, kcal }))
                    }
                    keyboardType="number-pad"
                  />
                  <TextField
                    containerStyle={s.grow}
                    label="Protein (g)"
                    value={plan.protein}
                    onChangeText={(protein) =>
                      setPlan((old) => ({ ...old, protein }))
                    }
                    keyboardType="number-pad"
                  />
                </View>
                <View style={s.two}>
                  <TextField
                    containerStyle={s.grow}
                    label="Carbs (g)"
                    value={plan.carbs}
                    onChangeText={(carbs) =>
                      setPlan((old) => ({ ...old, carbs }))
                    }
                    keyboardType="number-pad"
                  />
                  <TextField
                    containerStyle={s.grow}
                    label="Fat (g)"
                    value={plan.fat}
                    onChangeText={(fat) => setPlan((old) => ({ ...old, fat }))}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={s.two}>
                  <TextField
                    containerStyle={s.grow}
                    label="Fibre (g)"
                    value={plan.fiber}
                    onChangeText={(fiber) =>
                      setPlan((old) => ({ ...old, fiber }))
                    }
                    keyboardType="number-pad"
                  />
                  <TextField
                    containerStyle={s.grow}
                    label="Water (ml)"
                    value={plan.water}
                    onChangeText={(water) =>
                      setPlan((old) => ({ ...old, water }))
                    }
                    keyboardType="number-pad"
                  />
                </View>
                {macroKcal > 0 ? (
                  <Text style={s.muted}>
                    Macros provide approximately {macroKcal} kcal/day. Keep this
                    close to the calorie target.
                  </Text>
                ) : null}
              </View>
              {error ? <Text style={s.error}>{error}</Text> : null}
              <Button
                label="Save as new goal version"
                loading={savePlan.isPending}
                disabled={!plan.objective.trim() || !plan.content.trim()}
                onPress={() => {
                  setError(null);
                  savePlan.mutate();
                }}
              />
              {currentPlan?.active ? (
                <Button
                  label="Archive current goals"
                  variant="danger"
                  loading={deactivate.isPending}
                  onPress={() => {
                    deactivate.mutate(currentPlan.id);
                    setPlanOpen(false);
                  }}
                />
              ) : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
function nullable(value: string) {
  return value.trim() === "" ? null : Number(value);
}
function planPresetLabel(item: DietPlan) {
  return `${item.objective} · ${format(new Date(`${item.startsOn}T00:00:00`), "d MMM yyyy")} · ${item.kcalTarget ?? "—"} kcal${item.active ? " · Active" : ""}`;
}
function round(value: number | undefined) {
  return Math.round((value ?? 0) * 10) / 10;
}
function normaliseSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function CalorieHistoryRow({
  item,
  target,
}: {
  item: NutritionHistoryDay;
  target: number | null | undefined;
}) {
  const calories = item.totals.calories;
  const ratio = target ? calories / target : calories > 0 ? 1 : 0;
  const over = Boolean(target && calories > target);
  const color = over
    ? colors.alert
    : target && ratio >= 0.9
      ? colors.good
      : target && ratio < 0.7
        ? "#f0b35a"
        : colors.accent;
  return (
    <View style={s.historyRow}>
      <Text style={s.historyDate}>
        {format(new Date(`${item.date}T00:00:00`), "EEE")}
      </Text>
      <View style={s.historyTrack}>
        <View
          style={[
            s.historyFill,
            { width: `${Math.min(100, ratio * 100)}%`, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={[s.historyValue, over && s.dangerText]}>
        {round(calories)} kcal
      </Text>
      <Text style={s.historyProtein}>{round(item.totals.proteinG)}g P</Text>
    </View>
  );
}
function FoodSelectionCard({
  selection,
  onChange,
  onRemove,
}: {
  selection: FoodSelection;
  onChange: (change: Partial<FoodSelection>) => void;
  onRemove: () => void;
}) {
  const serving = selection.item.defaultServingGrams || 100;
  const factor = Number(selection.amount || 0) / 100;
  const nutrition = {
    calories: round(selection.item.calories * factor),
    protein: round(selection.item.proteinG * factor),
    carbs: round(selection.item.carbsG * factor),
    fat: round(selection.item.fatG * factor),
    fiber: round(selection.item.fiberG * factor),
  };
  return (
    <View style={s.selectionCard}>
      <View style={s.selectionHeader}>
        <View style={s.grow}>
          <Text style={s.foodName}>{selection.item.name}</Text>
          <Text style={s.muted}>
            {selection.item.servingLabel} ·{" "}
            {selection.item.origin === "INDIAN_DATASET"
              ? "Indian dataset estimate"
              : "USDA verified"}
          </Text>
        </View>
        <Pressable
          accessibilityLabel={`Remove ${selection.item.name}`}
          style={s.removeSelection}
          onPress={onRemove}
        >
          <Ionicons name="close" size={15} color={colors.alert} />
        </Pressable>
      </View>
      <View style={s.selectionHeader}>
        <Ionicons name="checkmark-circle" size={17} color={colors.good} />
        <Text style={s.portionTitle}>
          Nutrition auto-filled for {selection.amount || 0} g
        </Text>
      </View>
      <View style={s.nutritionPreview}>
        <View style={s.previewPrimary}>
          <Text style={s.previewValue}>{nutrition.calories}</Text>
          <Text style={s.previewLabel}>Calories</Text>
        </View>
        <NutrientPreview label="Protein" value={nutrition.protein} />
        <NutrientPreview label="Carbs" value={nutrition.carbs} />
        <NutrientPreview label="Fat" value={nutrition.fat} />
        <NutrientPreview label="Fibre" value={nutrition.fiber} />
      </View>
      <SearchableSelect
        compact
        label="Add to meal"
        value={meals.find((meal) => meal.value === selection.meal)?.label ?? ""}
        options={meals.map((meal) => meal.label)}
        onSelect={(label) =>
          onChange({
            meal: meals.find((meal) => meal.label === label)?.value ?? "SNACK",
          })
        }
      />
      <Text style={s.portionTitle}>Choose portion</Text>
      <View style={s.portionOptions}>
        {[
          { label: "½ serving", value: 0.5 },
          { label: "1 serving", value: 1 },
          { label: "2 servings", value: 2 },
        ].map((option) => (
          <Pressable
            key={option.label}
            style={[
              s.portionOption,
              Number(selection.amount) === round(serving * option.value) &&
                s.portionOptionActive,
            ]}
            onPress={() =>
              onChange({ amount: String(round(serving * option.value)) })
            }
          >
            <Text
              style={[
                s.portionOptionText,
                Number(selection.amount) === round(serving * option.value) &&
                  s.portionOptionTextActive,
              ]}
            >
              {option.label}
            </Text>
            <Text style={s.portionGrams}>
              {round(serving * option.value)} g
            </Text>
          </Pressable>
        ))}
      </View>
      <TextField
        label="Custom portion (grams)"
        value={selection.amount}
        onChangeText={(amount) => onChange({ amount })}
        keyboardType="decimal-pad"
      />
    </View>
  );
}
function NutrientPreview({ label, value }: { label: string; value: number }) {
  return (
    <View style={s.previewItem}>
      <Text style={s.previewValue}>{value}g</Text>
      <Text style={s.previewLabel}>{label}</Text>
    </View>
  );
}
function WaterBottle({
  amount,
  disabled,
  onPress,
}: {
  amount: -500 | 500;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${amount < 0 ? "Subtract" : "Add"} 500 millilitres of water`}
      disabled={disabled}
      style={[s.bottleButton, disabled && s.disabled]}
      onPress={onPress}
    >
      <Ionicons name="water" size={23} color="#59b9ff" />
      <Text style={s.bottleAmount}>{amount > 0 ? "+500" : "−500"}</Text>
    </Pressable>
  );
}
function Progress({
  value,
  target,
  blue = false,
  danger = false,
}: {
  value: number;
  target: number | null | undefined;
  blue?: boolean;
  danger?: boolean;
}) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  return (
    <View style={s.progress}>
      <View
        style={[
          s.progressFill,
          blue && s.progressBlue,
          danger && s.progressDanger,
          { width: `${pct}%` },
        ]}
      />
    </View>
  );
}
function Macro({
  label,
  value,
  target,
  color,
}: {
  label: string;
  value: number | undefined;
  target: number | null | undefined;
  color: string;
}) {
  const exceeded = target != null && (value ?? 0) > target;
  return (
    <View style={s.macro}>
      <View style={s.macroTop}>
        <Text style={s.macroLabel}>{label}</Text>
        <Text style={[s.macroValue, exceeded && s.dangerText]}>
          {round(value)} / {target ?? "—"}g
        </Text>
      </View>
      <View style={s.macroTrack}>
        <View
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: exceeded ? colors.alert : color,
            width: `${target ? Math.min(100, ((value ?? 0) / target) * 100) : 0}%`,
          }}
        />
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  content: { gap: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  grow: { flex: 1 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.glass2,
  },
  eyebrow: { ...typography.eyebrow, color: colors.accent },
  title: { ...typography.title, color: colors.ink },
  muted: { ...typography.caption, color: colors.dim },
  error: { ...typography.caption, color: colors.alert },
  dangerText: { color: colors.alert },
  add: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  dateNav: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  dateArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.glass2,
  },
  disabled: { opacity: 0.3 },
  dateCopy: { flex: 1, alignItems: "center" },
  datePickerLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  dateTitle: { ...typography.headline, color: colors.ink },
  dateSheet: {
    backgroundColor: colors.ground,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: colors.glassLine,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  dateDone: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  dateDoneText: {
    ...typography.caption,
    color: colors.onAccent,
    fontWeight: "800",
  },
  loading: { padding: spacing.xl, gap: spacing.md, alignItems: "center" },
  hero: { padding: spacing.lg, gap: spacing.lg },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroLabel: { ...typography.eyebrow, color: colors.dim },
  heroValue: { fontSize: 28, fontWeight: "800", color: colors.ink },
  heroTarget: { fontSize: 13, fontWeight: "500", color: colors.dim },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  progress: {
    height: 7,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: colors.glass2,
  },
  progressFill: { height: 7, borderRadius: 4, backgroundColor: colors.accent },
  progressBlue: { backgroundColor: "#59b9ff" },
  progressDanger: { backgroundColor: colors.alert },
  macroGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  macro: { width: "48%", gap: 5 },
  macroTop: { flexDirection: "row", justifyContent: "space-between" },
  macroLabel: { fontSize: 10, color: colors.dim },
  macroValue: { fontSize: 10, fontWeight: "700", color: colors.ink2 },
  macroTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.glass2,
    overflow: "hidden",
  },
  waterCard: { padding: spacing.lg, gap: spacing.md },
  waterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  waterTotal: { fontSize: 17, fontWeight: "800", color: "#59b9ff" },
  waterControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  waterProgress: { flex: 1, gap: 7 },
  waterHint: { fontSize: 9, color: colors.dim, textAlign: "center" },
  bottleButton: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(89,185,255,.12)",
    borderWidth: 1,
    borderColor: "rgba(89,185,255,.25)",
  },
  bottleAmount: { fontSize: 9, fontWeight: "800", color: "#59b9ff" },
  waterUndo: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.glass2,
  },
  waterUndoCorner: {
    alignSelf: "flex-end",
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  waterUndoText: { fontSize: 9, fontWeight: "700", color: colors.dim },
  cardTitle: { ...typography.headline, color: colors.ink },
  planCard: { padding: spacing.lg, gap: spacing.md },
  planTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  planIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `rgba(${colors.accentRgb},.11)`,
  },
  planText: { ...typography.body, color: colors.ink2, lineHeight: 21 },
  planScroll: { flexShrink: 1 },
  goalPresets: {
    gap: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.glassLine2,
  },
  goalForm: { gap: spacing.md },
  link: { ...typography.caption, color: colors.accent, fontWeight: "700" },
  empty: {
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { ...typography.title, color: colors.ink },
  smallAdd: { flexDirection: "row", alignItems: "center", gap: 4 },
  mealCard: { padding: spacing.md, gap: spacing.sm },
  mealHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  mealToggle: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  mealIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `rgba(${colors.accentRgb},.10)`,
  },
  mealEmpty: { ...typography.caption, color: colors.dim, paddingLeft: 44 },
  foodRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.glassLine2,
    paddingTop: spacing.sm,
  },
  foodName: { ...typography.caption, color: colors.ink, fontWeight: "700" },
  foodKcal: { ...typography.caption, color: colors.accent, fontWeight: "700" },
  historyCard: { padding: spacing.lg, gap: spacing.md },
  historyToggle: {
    flexDirection: "row",
    padding: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.glass2,
  },
  historyToggleButton: {
    width: 32,
    height: 28,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  historyToggleActive: { backgroundColor: colors.accent },
  trendCard: { padding: spacing.md, gap: spacing.md },
  trendLegend: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendLine: { width: 18, height: 3, borderRadius: 2 },
  chartScaleNote: {
    ...typography.caption,
    color: colors.dim,
    textAlign: "center",
  },
  trendChart: { marginHorizontal: -spacing.sm },
  trendPopup: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.field,
    backgroundColor: colors.glass2,
    borderWidth: 1,
    borderColor: colors.glassLine,
  },
  trendPopupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  trendStats: { flexDirection: "row", gap: spacing.sm },
  trendStat: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingVertical: spacing.sm,
    borderRadius: radius.field,
    backgroundColor: colors.glass,
  },
  trendStatValue: { fontSize: 11, fontWeight: "800" },
  openDayButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: `rgba(${colors.accentRgb},.10)`,
  },
  openDayText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "700",
  },
  historyRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  historyDate: { width: 28, fontSize: 9, color: colors.dim },
  historyTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.glass2,
    overflow: "hidden",
  },
  historyFill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  historyValue: {
    width: 62,
    fontSize: 9,
    color: colors.ink2,
    textAlign: "right",
  },
  historyProtein: {
    width: 38,
    fontSize: 9,
    color: colors.good,
    textAlign: "right",
  },
  planHistory: { padding: spacing.lg, gap: spacing.md },
  planHistoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.glassLine2,
  },
  state: { fontSize: 8, fontWeight: "800", color: colors.dim },
  stateActive: { color: colors.good },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,.58)",
  },
  sheet: {
    maxHeight: "88%",
    backgroundColor: colors.ground,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: colors.glassLine,
    padding: spacing.lg,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  sheetTitle: { ...typography.title, color: colors.ink },
  sheetContent: { gap: spacing.md, paddingBottom: spacing.xxl },
  searchResult: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.field,
    backgroundColor: colors.glass2,
  },
  sourceBadge: {
    minWidth: 42,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(89,185,255,.16)",
  },
  sourceBadgeIndian: {
    backgroundColor: `rgba(${colors.accentRgb},.18)`,
  },
  sourceBadgeText: {
    fontSize: 8,
    fontWeight: "800",
    color: colors.ink2,
  },
  manualHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.field,
    backgroundColor: `rgba(${colors.accentRgb},.08)`,
  },
  selectedResult: { opacity: 0.55 },
  resultAction: { fontSize: 9, fontWeight: "800", color: colors.accent },
  verified: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  selectionCard: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.glass2,
    borderWidth: 1,
    borderColor: colors.glassLine,
  },
  selectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  removeSelection: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239,100,100,.10)",
  },
  portionTitle: {
    ...typography.caption,
    color: colors.ink2,
    fontWeight: "700",
  },
  portionOptions: { flexDirection: "row", gap: spacing.sm },
  portionOption: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: radius.field,
    alignItems: "center",
    backgroundColor: colors.glass2,
    borderWidth: 1,
    borderColor: colors.glassLine,
  },
  portionOptionActive: {
    backgroundColor: `rgba(${colors.accentRgb},.12)`,
    borderColor: colors.accent,
  },
  portionOptionText: { fontSize: 9, fontWeight: "700", color: colors.ink2 },
  portionOptionTextActive: { color: colors.accent },
  portionGrams: { fontSize: 8, color: colors.dim, marginTop: 2 },
  two: { flexDirection: "row", gap: spacing.sm },
  nutritionPreview: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  previewPrimary: {
    width: "100%",
    padding: spacing.md,
    borderRadius: radius.field,
    backgroundColor: `rgba(${colors.accentRgb},.12)`,
    alignItems: "center",
  },
  previewItem: {
    flexGrow: 1,
    minWidth: "22%",
    paddingVertical: spacing.sm,
    paddingHorizontal: 6,
    borderRadius: radius.field,
    backgroundColor: colors.glass2,
    alignItems: "center",
  },
  previewValue: { fontSize: 15, fontWeight: "800", color: colors.ink },
  previewLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.dim,
    textTransform: "uppercase",
  },
  usdaNote: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.field,
    backgroundColor: `rgba(${colors.accentRgb},.08)`,
  },
});
