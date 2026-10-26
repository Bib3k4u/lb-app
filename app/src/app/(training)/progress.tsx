import { Fragment, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Line,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  differenceInCalendarWeeks,
  format,
  startOfDay,
  startOfWeek,
  subDays,
} from "date-fns";
import {
  Screen,
  GlassCard,
  Button,
  Chip,
  SearchableSelect,
  TextField,
} from "../../components/ui";
import { NutritionTrendChart } from "../../components/nutrition/NutritionTrendChart";
import { api, problemFrom } from "../../lib/api/client";
import type {
  NutritionDay,
  NutritionHistoryDay,
} from "../../lib/training/nutrition";
import type { Exercise, Workout } from "../../lib/training/types";
import { volumeOf } from "../../lib/training/equipment";
import { colors, radius, spacing, typography } from "../../lib/theme";

interface Metric {
  id: string;
  metricType: string;
  recordedOn: string;
  value: number;
  unit: string;
}
interface RecordItem {
  exerciseId: string;
  exerciseName: string;
  maxWeightKg: number | null;
  maxReps: number | null;
  achievedAt?: string;
}
interface Progress {
  metrics: Metric[];
  personalRecords: RecordItem[];
  workoutCount: number;
}
type Period = "4W" | "3M" | "6M" | "ALL";
type PointDetails = {
  date: string;
  exerciseName: string;
  workoutCount: number;
  workoutTitles: string[];
  sets: number;
  reps: number;
  maxWeightKg: number | null;
};
type Point = {
  key: string;
  label: string;
  value: number;
  details?: PointDetails;
};
const options = [
  ["WEIGHT_KG", "Weight", "kg"],
  ["BODY_FAT_PCT", "Body fat", "%"],
  ["WAIST_CM", "Waist", "cm"],
  ["CHEST_CM", "Chest", "cm"],
  ["HIP_CM", "Hips", "cm"],
  ["ARM_CM", "Arms", "cm"],
  ["THIGH_CM", "Thighs", "cm"],
  ["NECK_CM", "Neck", "cm"],
] as const;

export default function ProgressScreen() {
  const qc = useQueryClient();
  const [type, setType] = useState<(typeof options)[number]>(options[0]);
  const [value, setValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("3M");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [exerciseId, setExerciseId] = useState("");
  const [metricType, setMetricType] = useState("WEIGHT_KG");
  const [recordPage, setRecordPage] = useState(0);
  const progress = useQuery({
    queryKey: ["training", "progress"],
    queryFn: async () => (await api.get<Progress>("/me/progress")).data,
  });
  const workouts = useQuery({
    queryKey: ["training", "workouts", "me"],
    queryFn: async () => (await api.get<Workout[]>("/me/workouts")).data,
  });
  const exercises = useQuery({
    queryKey: ["training", "exercises"],
    queryFn: async () => (await api.get<Exercise[]>("/exercises")).data,
  });
  const nutritionDate = format(new Date(), "yyyy-MM-dd");
  const nutritionDay = useQuery({
    queryKey: ["nutrition", "me", nutritionDate],
    queryFn: async () =>
      (
        await api.get<NutritionDay>("/me/nutrition", {
          params: { date: nutritionDate },
        })
      ).data,
  });
  const nutritionHistory = useQuery({
    queryKey: ["nutrition", "me", "history"],
    queryFn: async () =>
      (
        await api.get<NutritionHistoryDay[]>("/me/nutrition/history", {
          params: { days: 14 },
        })
      ).data,
  });
  const add = useMutation({
    mutationFn: () =>
      api.post("/me/progress/metrics", {
        metricType: type[0],
        recordedOn: format(new Date(), "yyyy-MM-dd"),
        value: Number(value),
        unit: type[2],
      }),
    onSuccess: () => {
      setValue("");
      setAdding(false);
      void qc.invalidateQueries({ queryKey: ["training", "progress"] });
    },
  });
  async function save() {
    setError(null);
    if (!value || Number(value) <= 0) {
      setError("Enter a valid value.");
      return;
    }
    try {
      await add.mutateAsync();
    } catch (e) {
      setError(problemFrom(e).detail ?? "Could not record metric.");
    }
  }

  const completedWorkouts = useMemo(
    () =>
      (workouts.data ?? [])
        .filter((workout) => workout.completed)
        .sort(
          (a, b) =>
            new Date(a.performedAt).getTime() -
            new Date(b.performedAt).getTime(),
        ),
    [workouts.data],
  );
  const performedExercises = useMemo(() => {
    const names = new Map<string, string>();
    completedWorkouts.forEach((workout) =>
      workout.sets.forEach((set) =>
        names.set(set.exerciseId, set.exerciseName),
      ),
    );
    return [...names.entries()]
      .map(([id, name]) => ({
        id,
        name,
        exercise: (exercises.data ?? []).find((item) => item.id === id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [completedWorkouts, exercises.data]);
  const muscleGroups = useMemo(
    () =>
      Array.from(
        new Set(
          performedExercises.flatMap(({ exercise }) =>
            exercise
              ? [
                  exercise.primaryMuscleGroup,
                  ...(exercise.secondaryMuscleGroup ?? "").split(","),
                ]
                  .map((item) => item.trim())
                  .filter(Boolean)
              : [],
          ),
        ),
      ).sort(),
    [performedExercises],
  );
  const selectedMuscleGroup = muscleGroups.includes(muscleGroup)
    ? muscleGroup
    : (muscleGroups[0] ?? "");
  const exerciseOptions = useMemo(
    () =>
      performedExercises.filter(({ exercise }) => {
        if (!selectedMuscleGroup) return false;
        const groups = exercise
          ? [
              exercise.primaryMuscleGroup,
              ...(exercise.secondaryMuscleGroup ?? "").split(","),
            ].map((item) => item.trim())
          : [];
        return groups.includes(selectedMuscleGroup);
      }),
    [selectedMuscleGroup, performedExercises],
  );
  const selectedExerciseId = exerciseOptions.some(
    (item) => item.id === exerciseId,
  )
    ? exerciseId
    : (exerciseOptions[0]?.id ?? "");

  const analytics = useMemo(() => {
    const all = completedWorkouts;
    const days =
      period === "4W"
        ? 28
        : period === "3M"
          ? 90
          : period === "6M"
            ? 180
            : null;
    const now = new Date();
    const cutoff = days ? startOfDay(subDays(now, days - 1)) : null;
    const inPeriod = all.filter(
      (workout) =>
        (!cutoff || new Date(workout.performedAt) >= cutoff) &&
        workout.sets.some((set) => set.exerciseId === selectedExerciseId),
    );
    const selectedSets = (workout: Workout) =>
      workout.sets.filter((set) => set.exerciseId === selectedExerciseId);
    const workoutVolume = (workout: Workout) =>
      selectedSets(workout).reduce(
        (sum, set) => sum + (set.volume ?? volumeOf(set.reps, set.weightKg)),
        0,
      );
    const volumeByDay = new Map<
      string,
      {
        volume: number;
        sets: number;
        reps: number;
        maxWeightKg: number | null;
        workoutTitles: Set<string>;
        workoutIds: Set<string>;
      }
    >();
    inPeriod.forEach((workout) => {
      const date = format(new Date(workout.performedAt), "yyyy-MM-dd");
      const sets = selectedSets(workout);
      const existing = volumeByDay.get(date) ?? {
        volume: 0,
        sets: 0,
        reps: 0,
        maxWeightKg: null,
        workoutTitles: new Set<string>(),
        workoutIds: new Set<string>(),
      };
      existing.volume += workoutVolume(workout);
      existing.sets += sets.length;
      existing.reps += sets.reduce((sum, set) => sum + (set.reps ?? 0), 0);
      existing.workoutTitles.add(workout.title);
      existing.workoutIds.add(workout.id);
      sets.forEach((set) => {
        if (set.weightKg != null)
          existing.maxWeightKg = Math.max(
            existing.maxWeightKg ?? 0,
            set.weightKg,
          );
      });
      volumeByDay.set(date, existing);
    });
    const exerciseName =
      performedExercises.find((item) => item.id === selectedExerciseId)?.name ??
      "Exercise";
    const volumeSeries: Point[] = [...volumeByDay.entries()].map(
      ([date, item]) => ({
        key: date,
        label: format(new Date(`${date}T00:00:00`), "d MMM"),
        value: Math.round(item.volume),
        details: {
          date,
          exerciseName,
          workoutCount: item.workoutIds.size,
          workoutTitles: [...item.workoutTitles],
          sets: item.sets,
          reps: item.reps,
          maxWeightKg: item.maxWeightKg,
        },
      }),
    );
    const currentVolume = inPeriod.reduce(
      (sum, workout) => sum + workoutVolume(workout),
      0,
    );
    let priorVolume = 0;
    if (days && cutoff) {
      const previousCutoff = startOfDay(subDays(cutoff, days));
      priorVolume = all
        .filter((workout) => {
          const date = new Date(workout.performedAt);
          return (
            date >= previousCutoff &&
            date < cutoff &&
            workout.sets.some((set) => set.exerciseId === selectedExerciseId)
          );
        })
        .reduce((sum, workout) => sum + workoutVolume(workout), 0);
    }
    const trend =
      priorVolume > 0
        ? Math.round(((currentVolume - priorVolume) / priorVolume) * 100)
        : currentVolume > 0
          ? 100
          : 0;
    const totalSets = inPeriod.reduce(
      (sum, workout) => sum + selectedSets(workout).length,
      0,
    );
    const avgVolume = inPeriod.length ? currentVolume / inPeriod.length : 0;
    const best = inPeriod.reduce<{ title: string; volume: number } | null>(
      (result, workout) => {
        const workoutTotal = workoutVolume(workout);
        return !result || workoutTotal > result.volume
          ? { title: workout.title, volume: workoutTotal }
          : result;
      },
      null,
    );
    const thisWeek = startOfWeek(now, { weekStartsOn: 1 });
    const frequency = Array.from({ length: 8 }, (_, index) => {
      const weekStart = subDays(thisWeek, (7 - index) * 7);
      const count = all.filter(
        (workout) =>
          differenceInCalendarWeeks(new Date(workout.performedAt), weekStart, {
            weekStartsOn: 1,
          }) === 0,
      ).length;
      return { label: index === 7 ? "Now" : format(weekStart, "d MMM"), count };
    });
    return {
      volumeSeries,
      currentVolume,
      trend,
      workouts: inPeriod.length,
      totalSets,
      avgVolume,
      best,
      frequency,
    };
  }, [completedWorkouts, period, performedExercises, selectedExerciseId]);
  const measurementSeries = useMemo<Point[]>(
    () =>
      (progress.data?.metrics ?? [])
        .filter((metric) => metric.metricType === metricType)
        .sort((a, b) => a.recordedOn.localeCompare(b.recordedOn))
        .map((metric) => ({
          key: metric.id,
          label: format(new Date(`${metric.recordedOn}T00:00:00`), "d MMM"),
          value: metric.value,
        })),
    [metricType, progress.data?.metrics],
  );
  const records = progress.data?.personalRecords ?? [];
  const recordPageCount = Math.ceil(records.length / 5);
  const safeRecordPage = Math.min(recordPage, Math.max(0, recordPageCount - 1));
  const visibleRecords = records.slice(
    safeRecordPage * 5,
    safeRecordPage * 5 + 5,
  );
  const loading =
    progress.isPending || workouts.isPending || exercises.isPending;
  const loadError = progress.error ?? workouts.error ?? exercises.error;

  return (
    <Screen scroll contentContainerStyle={s.content}>
      <View style={s.header}>
        <View style={s.grow}>
          <Text style={s.eyebrow}>YOUR RESULTS</Text>
          <Text style={s.title}>Performance</Text>
          <Text style={s.subtitle}>
            Detailed training and body-measurement trends.
          </Text>
        </View>
        <Pressable
          style={s.addButton}
          onPress={() => setAdding((open) => !open)}
        >
          <Ionicons
            name={adding ? "close" : "add"}
            size={22}
            color={colors.onAccent}
          />
        </Pressable>
      </View>
      {adding ? (
        <GlassCard style={s.form} raised>
          <Text style={s.heading}>Record measurement</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.rail}
          >
            {options.map((option) => (
              <Chip
                key={option[0]}
                label={option[1]}
                selected={type[0] === option[0]}
                onPress={() => setType(option)}
              />
            ))}
          </ScrollView>
          <TextField
            label={`${type[1]} (${type[2]})`}
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
            placeholder="0"
          />
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Button
            label="Save measurement"
            onPress={() => void save()}
            loading={add.isPending}
          />
        </GlassCard>
      ) : null}
      {loading ? (
        <GlassCard style={s.loadState}>
          <ActivityIndicator color={colors.accent} />
          <Text style={s.meta}>Loading performance data…</Text>
        </GlassCard>
      ) : loadError ? (
        <GlassCard style={s.loadState}>
          <Ionicons
            name="cloud-offline-outline"
            size={22}
            color={colors.alert}
          />
          <Text style={s.error}>
            {problemFrom(loadError).detail ?? "Could not load progress."}
          </Text>
        </GlassCard>
      ) : null}

      <GlassCard style={s.graphCard} raised>
        <View style={s.graphHeader}>
          <View>
            <Text style={s.eyebrow}>TRAINING LOAD</Text>
            <Text style={s.graphTitle}>Volume performance</Text>
          </View>
          <View style={[s.trendPill, analytics.trend < 0 && s.trendDown]}>
            <Ionicons
              name={analytics.trend < 0 ? "trending-down" : "trending-up"}
              size={14}
              color={analytics.trend < 0 ? colors.alert : colors.good}
            />
            <Text
              style={[
                s.trendText,
                analytics.trend < 0 && { color: colors.alert },
              ]}
            >
              {analytics.trend > 0 ? "+" : ""}
              {analytics.trend}%
            </Text>
          </View>
        </View>
        <View style={s.periods}>
          {(["4W", "3M", "6M", "ALL"] as Period[]).map((item) => (
            <Pressable
              key={item}
              style={[s.period, period === item && s.periodActive]}
              onPress={() => setPeriod(item)}
            >
              <Text
                style={[s.periodText, period === item && s.periodTextActive]}
              >
                {item === "ALL" ? "All" : item}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={s.chartFilters}>
          <View style={s.chartFilter}>
            <SearchableSelect
              compact
              label="Muscle group"
              value={selectedMuscleGroup}
              options={muscleGroups}
              placeholder="No muscle data"
              searchPlaceholder="Search muscles…"
              onSelect={(value) => {
                setMuscleGroup(value);
                setExerciseId("");
              }}
            />
          </View>
          <View style={s.chartFilter}>
            <SearchableSelect
              compact
              label="Exercise"
              value={
                exerciseOptions.find((item) => item.id === selectedExerciseId)
                  ?.name ?? ""
              }
              options={exerciseOptions.map((item) => item.name)}
              placeholder="No exercises"
              searchPlaceholder="Search exercises…"
              onSelect={(name) =>
                setExerciseId(
                  exerciseOptions.find((item) => item.name === name)?.id ?? "",
                )
              }
            />
          </View>
        </View>
        <PerformanceLineChart
          points={analytics.volumeSeries}
          suffix="kg"
          empty="Complete weighted workouts to build your volume graph."
        />
        <View style={s.graphStats}>
          <MiniStat
            value={formatVolume(analytics.currentVolume)}
            label="Total volume"
          />
          <View style={s.divider} />
          <MiniStat value={String(analytics.workouts)} label="Workouts" />
          <View style={s.divider} />
          <MiniStat value={String(analytics.totalSets)} label="Sets" />
          <View style={s.divider} />
          <MiniStat
            value={formatVolume(analytics.avgVolume)}
            label="Avg/session"
          />
        </View>
        {analytics.best ? (
          <View style={s.best}>
            <View style={s.bestIcon}>
              <Ionicons name="trophy-outline" size={18} color={colors.accent} />
            </View>
            <View style={s.grow}>
              <Text style={s.filterLabel}>BEST SESSION IN PERIOD</Text>
              <Text style={s.bestTitle}>{analytics.best.title}</Text>
            </View>
            <Text style={s.bestValue}>
              {formatVolume(analytics.best.volume)}
            </Text>
          </View>
        ) : null}
      </GlassCard>

      <View style={s.sectionHeader}>
        <View>
          <Text style={s.eyebrow}>NUTRITION</Text>
          <Text style={s.sectionTitle}>14-day intake</Text>
        </View>
        <Text style={s.meta}>Calories · protein · water</Text>
      </View>
      {nutritionHistory.isPending || nutritionDay.isPending ? (
        <GlassCard style={s.loadState}>
          <ActivityIndicator color={colors.accent} />
          <Text style={s.meta}>Loading nutrition trend…</Text>
        </GlassCard>
      ) : nutritionHistory.error || nutritionDay.error ? (
        <GlassCard style={s.loadState}>
          <Ionicons
            name="cloud-offline-outline"
            size={22}
            color={colors.alert}
          />
          <Text style={s.error}>Could not load nutrition trend.</Text>
        </GlassCard>
      ) : (
        <NutritionTrendChart
          days={(nutritionHistory.data ?? []).slice(-14)}
          calorieTarget={nutritionDay.data?.plan?.kcalTarget}
          proteinTarget={nutritionDay.data?.plan?.proteinG}
          waterTarget={nutritionDay.data?.plan?.waterMlTarget}
        />
      )}

      <GlassCard style={s.graphCard}>
        <View style={s.graphHeader}>
          <View>
            <Text style={s.eyebrow}>CONSISTENCY</Text>
            <Text style={s.graphTitle}>Workout frequency</Text>
          </View>
          <Text style={s.meta}>Last 8 weeks</Text>
        </View>
        <FrequencyChart values={analytics.frequency} />
      </GlassCard>

      <GlassCard style={s.graphCard}>
        <View style={s.graphHeader}>
          <View>
            <Text style={s.eyebrow}>BODY METRICS</Text>
            <Text style={s.graphTitle}>Measurement trend</Text>
          </View>
          <Pressable style={s.smallAdd} onPress={() => setAdding(true)}>
            <Ionicons name="add" size={16} color={colors.accent} />
            <Text style={s.smallAddText}>Add</Text>
          </Pressable>
        </View>
        <SearchableSelect
          compact
          label="Measurement"
          value={options.find((option) => option[0] === metricType)?.[1] ?? ""}
          options={options.map((option) => option[1])}
          searchPlaceholder="Search measurements…"
          onSelect={(label) => {
            const selected = options.find((option) => option[1] === label);
            if (selected) setMetricType(selected[0]);
          }}
        />
        <PerformanceLineChart
          points={measurementSeries}
          suffix={options.find((option) => option[0] === metricType)?.[2] ?? ""}
          empty="Record this measurement more than once to see its trend."
          compact
        />
      </GlassCard>

      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Personal records</Text>
        <Text style={s.meta}>
          {progress.data?.personalRecords.length ?? 0} exercises
        </Text>
      </View>
      {records.length === 0 ? (
        <GlassCard style={s.empty}>
          <Ionicons name="trophy-outline" size={28} color={colors.accent} />
          <Text style={s.meta}>
            Log weighted workouts to unlock personal records.
          </Text>
        </GlassCard>
      ) : (
        visibleRecords.map((record) => (
          <GlassCard key={record.exerciseId} style={s.row}>
            <View style={s.recordIcon}>
              <Ionicons name="trophy" size={18} color={colors.accent} />
            </View>
            <View style={s.grow}>
              <Text style={s.heading}>{record.exerciseName}</Text>
              <Text style={s.meta}>
                {record.achievedAt
                  ? format(new Date(record.achievedAt), "d MMM yyyy")
                  : "Personal best"}
              </Text>
            </View>
            <View style={s.recordValues}>
              {record.maxWeightKg != null ? (
                <Text style={s.metric}>{record.maxWeightKg} kg</Text>
              ) : null}
              {record.maxReps != null ? (
                <Text style={s.meta}>{record.maxReps} reps</Text>
              ) : null}
            </View>
          </GlassCard>
        ))
      )}
      {recordPageCount > 1 ? (
        <View style={s.pagination}>
          <Pressable
            disabled={safeRecordPage === 0}
            style={[s.pageButton, safeRecordPage === 0 && s.pageButtonDisabled]}
            onPress={() => setRecordPage((page) => Math.max(0, page - 1))}
          >
            <Ionicons name="chevron-back" size={17} color={colors.ink2} />
            <Text style={s.pageButtonText}>Previous</Text>
          </Pressable>
          <Text style={s.pageCount}>
            {safeRecordPage + 1} / {recordPageCount}
          </Text>
          <Pressable
            disabled={safeRecordPage === recordPageCount - 1}
            style={[
              s.pageButton,
              safeRecordPage === recordPageCount - 1 && s.pageButtonDisabled,
            ]}
            onPress={() =>
              setRecordPage((page) => Math.min(recordPageCount - 1, page + 1))
            }
          >
            <Text style={s.pageButtonText}>Next</Text>
            <Ionicons name="chevron-forward" size={17} color={colors.ink2} />
          </Pressable>
        </View>
      ) : null}

      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Recent measurements</Text>
        <Text style={s.meta}>{progress.data?.metrics.length ?? 0} entries</Text>
      </View>
      {(progress.data?.metrics ?? []).length === 0 ? (
        <GlassCard style={s.empty}>
          <Ionicons name="analytics-outline" size={28} color={colors.accent} />
          <Text style={s.meta}>No measurements recorded yet.</Text>
        </GlassCard>
      ) : (
        (progress.data?.metrics ?? []).slice(0, 12).map((metric) => (
          <GlassCard key={metric.id} style={s.row}>
            <View style={s.metricIcon}>
              <Ionicons name="pulse-outline" size={18} color={colors.accent} />
            </View>
            <View style={s.grow}>
              <Text style={s.heading}>
                {options.find(
                  (option) => option[0] === metric.metricType,
                )?.[1] ?? metric.metricType}
              </Text>
              <Text style={s.meta}>
                {format(
                  new Date(`${metric.recordedOn}T00:00:00`),
                  "d MMM yyyy",
                )}
              </Text>
            </View>
            <Text style={s.metric}>
              {metric.value} {metric.unit}
            </Text>
          </GlassCard>
        ))
      )}
    </Screen>
  );
}

function PerformanceLineChart({
  points,
  suffix,
  empty,
  compact = false,
}: {
  points: Point[];
  suffix: string;
  empty: string;
  compact?: boolean;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  if (points.length === 0)
    return (
      <View style={[s.chartEmpty, compact && s.chartEmptyCompact]}>
        <Ionicons name="stats-chart-outline" size={24} color={colors.dim} />
        <Text style={s.chartEmptyText}>{empty}</Text>
      </View>
    );
  const selected = points.find((point) => point.key === selectedKey) ?? null;
  const width = 320;
  const height = compact ? 130 : 185;
  const left = 38;
  const right = 10;
  const top = 18;
  const bottom = 28;
  const values = points.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const floor =
    minValue === maxValue
      ? Math.max(0, minValue * 0.8)
      : Math.max(0, minValue - (maxValue - minValue) * 0.15);
  const ceiling =
    maxValue === floor ? floor + 1 : maxValue + (maxValue - floor) * 0.12;
  const coords = points.map((point, index) => ({
    x:
      points.length === 1
        ? (left + width - right) / 2
        : left + (index / (points.length - 1)) * (width - left - right),
    y:
      top +
      ((ceiling - point.value) / (ceiling - floor)) * (height - top - bottom),
    ...point,
  }));
  const line = coords
    .map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`)
    .join(" ");
  const area = `${line} L ${coords.at(-1)?.x ?? left} ${height - bottom} L ${coords[0]?.x ?? left} ${height - bottom} Z`;
  const labelIndices = [
    ...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]),
  ];
  return (
    <View style={s.chart}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.accent} stopOpacity="0.32" />
            <Stop offset="1" stopColor={colors.accent} stopOpacity="0.01" />
          </LinearGradient>
        </Defs>
        {[0, 1, 2, 3].map((step) => {
          const y = top + (step / 3) * (height - top - bottom);
          const axisValue = ceiling - (step / 3) * (ceiling - floor);
          return (
            <Fragment key={step}>
              <Line
                x1={left}
                x2={width - right}
                y1={y}
                y2={y}
                stroke={colors.glassLine2}
                strokeWidth="1"
              />
              <SvgText
                x={left - 5}
                y={y + 3}
                fill={colors.dim}
                fontSize="7"
                textAnchor="end"
              >
                {formatAxis(axisValue)}
              </SvgText>
            </Fragment>
          );
        })}
        <Path d={area} fill="url(#volumeFill)" />
        <Path
          d={line}
          fill="none"
          stroke={colors.accent}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map((point, index) => (
          <Fragment key={point.key}>
            <Circle
              cx={point.x}
              cy={point.y}
              r={
                selected?.key === point.key
                  ? 5
                  : index === coords.length - 1
                    ? 4
                    : 2.5
              }
              fill={
                selected?.key === point.key || index === coords.length - 1
                  ? colors.accent
                  : colors.ground
              }
              stroke={colors.accent}
              strokeWidth="2"
            />
            <Circle
              cx={point.x}
              cy={point.y}
              r={12}
              fill="transparent"
              onPress={() =>
                setSelectedKey((key) => (key === point.key ? null : point.key))
              }
            />
          </Fragment>
        ))}
        {labelIndices.map((index) => (
          <SvgText
            key={index}
            x={coords[index]!.x}
            y={height - 8}
            fill={colors.dim}
            fontSize="8"
            textAnchor={
              index === 0
                ? "start"
                : index === points.length - 1
                  ? "end"
                  : "middle"
            }
          >
            {coords[index]!.label}
          </SvgText>
        ))}
        <SvgText
          x={width - right}
          y={12}
          fill={colors.dim}
          fontSize="8"
          textAnchor="end"
        >
          {suffix}
        </SvgText>
      </Svg>
      {selected ? (
        <View style={s.pointPopup}>
          <View style={s.pointPopupHeader}>
            <View style={s.pointPopupIcon}>
              <Ionicons
                name={selected.details ? "barbell-outline" : "pulse-outline"}
                size={17}
                color={colors.accent}
              />
            </View>
            <View style={s.grow}>
              <Text style={s.pointTitle}>
                {selected.details?.exerciseName ?? "Measurement"}
              </Text>
              <Text style={s.meta}>
                {selected.details
                  ? format(
                      new Date(`${selected.details.date}T00:00:00`),
                      "EEEE, d MMM yyyy",
                    )
                  : selected.label}
              </Text>
            </View>
            <Text style={s.pointValue}>
              {selected.value} {suffix}
            </Text>
            <Pressable hitSlop={8} onPress={() => setSelectedKey(null)}>
              <Ionicons name="close" size={18} color={colors.dim} />
            </Pressable>
          </View>
          {selected.details ? (
            <>
              <View style={s.pointStats}>
                <MiniStat value={String(selected.details.sets)} label="Sets" />
                <View style={s.divider} />
                <MiniStat
                  value={String(selected.details.reps)}
                  label="Total reps"
                />
                <View style={s.divider} />
                <MiniStat
                  value={
                    selected.details.maxWeightKg == null
                      ? "—"
                      : `${selected.details.maxWeightKg} kg`
                  }
                  label="Top weight"
                />
                <View style={s.divider} />
                <MiniStat
                  value={String(selected.details.workoutCount)}
                  label="Sessions"
                />
              </View>
              <Text style={s.pointSessions} numberOfLines={2}>
                {selected.details.workoutTitles.join(" · ")}
              </Text>
            </>
          ) : null}
        </View>
      ) : (
        <Text style={s.chartHint}>Tap a dot to view its details</Text>
      )}
    </View>
  );
}

function FrequencyChart({
  values,
}: {
  values: { label: string; count: number }[];
}) {
  const max = Math.max(1, ...values.map((item) => item.count));
  return (
    <View style={s.frequency}>
      {values.map((item) => (
        <View key={item.label} style={s.barColumn}>
          <Text style={s.barValue}>{item.count || ""}</Text>
          <View style={s.barTrack}>
            <View
              style={[
                s.bar,
                {
                  height: Math.max(item.count ? 8 : 3, (item.count / max) * 78),
                },
              ]}
            />
          </View>
          <Text style={s.barLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}
function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={s.miniStat}>
      <Text style={s.miniValue}>{value}</Text>
      <Text style={s.miniLabel}>{label}</Text>
    </View>
  );
}
function formatVolume(value: number) {
  return value >= 1000
    ? `${(value / 1000).toFixed(1)}k kg`
    : `${Math.round(value)} kg`;
}
function formatAxis(value: number) {
  return value >= 1000
    ? `${(value / 1000).toFixed(1)}k`
    : String(Math.round(value));
}

const s = StyleSheet.create({
  content: { paddingTop: spacing.lg, gap: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  grow: { flex: 1 },
  eyebrow: { ...typography.eyebrow, color: colors.accent },
  title: { ...typography.display, color: colors.ink },
  subtitle: { ...typography.caption, color: colors.dim, marginTop: spacing.xs },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  form: { padding: spacing.lg, gap: spacing.md },
  rail: { gap: spacing.sm, paddingRight: spacing.lg },
  heading: { ...typography.headline, color: colors.ink },
  error: { ...typography.caption, color: colors.alert },
  loadState: {
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  graphCard: { padding: spacing.lg, gap: spacing.lg },
  graphHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  graphTitle: { ...typography.title, color: colors.ink },
  trendPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: "rgba(63,209,124,0.10)",
  },
  trendDown: { backgroundColor: "rgba(244,96,96,0.10)" },
  trendText: { ...typography.caption, color: colors.good },
  periods: {
    flexDirection: "row",
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.glass2,
  },
  period: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  periodActive: { backgroundColor: colors.accent },
  periodText: { ...typography.caption, color: colors.dim },
  periodTextActive: { color: colors.onAccent, fontWeight: "700" },
  filterLabel: { ...typography.eyebrow, color: colors.dim },
  chartFilters: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  chartFilter: { flex: 1, minWidth: 0 },
  chart: { marginHorizontal: -spacing.sm, gap: spacing.sm },
  chartHint: { ...typography.caption, color: colors.dim, textAlign: "center" },
  pointPopup: {
    marginHorizontal: spacing.sm,
    padding: spacing.md,
    gap: spacing.md,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: `rgba(${colors.accentRgb},0.24)`,
    backgroundColor: colors.glass2,
  },
  pointPopupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  pointPopupIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `rgba(${colors.accentRgb},0.11)`,
  },
  pointTitle: { ...typography.caption, color: colors.ink, fontWeight: "700" },
  pointValue: { ...typography.headline, color: colors.accent },
  pointStats: { minHeight: 38, flexDirection: "row" },
  pointSessions: { ...typography.caption, color: colors.ink2 },
  chartEmpty: {
    minHeight: 185,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  chartEmptyCompact: { minHeight: 130 },
  chartEmptyText: {
    ...typography.caption,
    color: colors.dim,
    textAlign: "center",
  },
  graphStats: {
    flexDirection: "row",
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.glassLine2,
  },
  miniStat: { flex: 1, alignItems: "center", gap: 3 },
  miniValue: { ...typography.caption, color: colors.ink, fontWeight: "800" },
  miniLabel: { fontSize: 8, color: colors.dim, textAlign: "center" },
  divider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.glassLine2,
  },
  best: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.field,
    backgroundColor: colors.glass2,
  },
  bestIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `rgba(${colors.accentRgb},0.11)`,
  },
  bestTitle: { ...typography.caption, color: colors.ink, marginTop: 2 },
  bestValue: { ...typography.headline, color: colors.accent },
  frequency: {
    height: 118,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  barColumn: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  barTrack: {
    height: 82,
    width: "72%",
    justifyContent: "flex-end",
    borderRadius: 7,
    backgroundColor: colors.glass2,
    overflow: "hidden",
  },
  bar: { width: "100%", borderRadius: 7, backgroundColor: colors.accent },
  barValue: { fontSize: 8, color: colors.ink2 },
  barLabel: { fontSize: 7, color: colors.dim },
  smallAdd: { flexDirection: "row", alignItems: "center", gap: 3 },
  smallAddText: { ...typography.caption, color: colors.accent },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  sectionTitle: { ...typography.title, color: colors.ink },
  meta: { ...typography.caption, color: colors.dim },
  empty: { padding: spacing.xl, alignItems: "center", gap: spacing.md },
  row: {
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  recordIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `rgba(${colors.accentRgb},.13)`,
    alignItems: "center",
    justifyContent: "center",
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.glass2,
    alignItems: "center",
    justifyContent: "center",
  },
  metric: { ...typography.headline, color: colors.accent },
  recordValues: { alignItems: "flex-end", gap: 2 },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pageButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.glass2,
    borderWidth: 1,
    borderColor: colors.glassLine,
  },
  pageButtonDisabled: { opacity: 0.35 },
  pageButtonText: {
    ...typography.caption,
    color: colors.ink2,
    fontWeight: "700",
  },
  pageCount: { ...typography.caption, color: colors.dim },
});
