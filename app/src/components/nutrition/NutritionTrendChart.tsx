import { Fragment, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Line,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { GlassCard } from "../ui";
import type { NutritionHistoryDay } from "../../lib/training/nutrition";
import { colors, radius, spacing, typography } from "../../lib/theme";

export function NutritionTrendChart({
  days,
  calorieTarget,
  proteinTarget,
  waterTarget,
  onOpenDay,
}: {
  days: NutritionHistoryDay[];
  calorieTarget?: number | null | undefined;
  proteinTarget?: number | null | undefined;
  waterTarget?: number | null | undefined;
  onOpenDay?: (date: string) => void;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const width = 320;
  const height = 188;
  const left = 28;
  const right = 8;
  const top = 10;
  const bottom = 25;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const count = Math.max(1, days.length);
  const calorieScale = Math.max(
    calorieTarget ?? 0,
    ...days.map((item) => item.totals.calories),
    1,
  );
  const proteinScale = Math.max(
    proteinTarget ?? 0,
    ...days.map((item) => item.totals.proteinG),
    1,
  );
  const waterScale = Math.max(
    waterTarget ?? 5000,
    ...days.map((item) => item.totals.waterMl),
    1,
  );
  const x = (index: number) => left + ((index + 0.5) / count) * plotWidth;
  const y = (value: number, scale: number) =>
    top + (1 - Math.min(1, value / scale)) * plotHeight;
  const calories = days.map((item, index) => ({
    x: x(index),
    y: y(item.totals.calories, calorieScale),
  }));
  const protein = days.map((item, index) => ({
    x: x(index),
    y: y(item.totals.proteinG, proteinScale),
  }));
  const water = days.map((item, index) => ({
    x: x(index),
    y: y(item.totals.waterMl, waterScale),
  }));
  const path = (points: { x: number; y: number }[]) => {
    if (!points.length) return "";
    if (points.length === 1) return `M${points[0]!.x},${points[0]!.y}`;
    return points.slice(1).reduce((result, point, index) => {
      const previous = points[index]!;
      const middleX = (previous.x + point.x) / 2;
      return `${result} C${middleX},${previous.y} ${middleX},${point.y} ${point.x},${point.y}`;
    }, `M${points[0]!.x},${points[0]!.y}`);
  };
  const area = (points: { x: number; y: number }[]) =>
    points.length
      ? `${path(points)} L${points.at(-1)!.x},${top + plotHeight} L${points[0]!.x},${top + plotHeight} Z`
      : "";
  const selected = days.find((item) => item.date === selectedDate) ?? null;
  const labelIndices = Array.from(
    new Set([0, Math.floor((days.length - 1) / 2), days.length - 1]),
  ).filter((index) => index >= 0);

  return (
    <GlassCard style={s.card}>
      <View style={s.legend}>
        <TrendLegend color="#f2a65a" label="Calories" />
        <TrendLegend color={colors.good} label="Protein" />
        <TrendLegend color="#59b9ff" label="Water" />
      </View>
      <Text style={s.scaleNote}>
        Each area uses its own target scale; tap any day for exact values.
      </Text>
      {days.length ? (
        <View style={s.chart}>
          <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
            <Defs>
              <LinearGradient
                id="nutritionCaloriesArea"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <Stop offset="0" stopColor="#f2a65a" stopOpacity="0.32" />
                <Stop offset="1" stopColor="#f2a65a" stopOpacity="0.02" />
              </LinearGradient>
              <LinearGradient
                id="nutritionProteinArea"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <Stop offset="0" stopColor={colors.good} stopOpacity="0.28" />
                <Stop offset="1" stopColor={colors.good} stopOpacity="0.02" />
              </LinearGradient>
              <LinearGradient
                id="nutritionWaterArea"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <Stop offset="0" stopColor="#59b9ff" stopOpacity="0.26" />
                <Stop offset="1" stopColor="#59b9ff" stopOpacity="0.01" />
              </LinearGradient>
            </Defs>
            {[0, 1, 2, 3, 4].map((step) => {
              const lineY = top + (step / 4) * plotHeight;
              return (
                <Fragment key={step}>
                  <Line
                    x1={left}
                    x2={width - right}
                    y1={lineY}
                    y2={lineY}
                    stroke={colors.glassLine2}
                    strokeWidth="1"
                  />
                  <SvgText
                    x={left - 5}
                    y={lineY + 3}
                    fill={colors.dim}
                    fontSize="7"
                    textAnchor="end"
                  >
                    {100 - step * 25}%
                  </SvgText>
                </Fragment>
              );
            })}
            <Path d={area(calories)} fill="url(#nutritionCaloriesArea)" />
            <Path d={area(protein)} fill="url(#nutritionProteinArea)" />
            <Path d={area(water)} fill="url(#nutritionWaterArea)" />
            <Path
              d={path(calories)}
              fill="none"
              stroke="#f2a65a"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d={path(protein)}
              fill="none"
              stroke={colors.good}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d={path(water)}
              fill="none"
              stroke="#59b9ff"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {days.map((item, index) => (
              <Fragment key={item.date}>
                <Circle
                  cx={calories[index]!.x}
                  cy={calories[index]!.y}
                  r={selectedDate === item.date ? 4 : 2.4}
                  fill="#f2a65a"
                />
                <Circle
                  cx={protein[index]!.x}
                  cy={protein[index]!.y}
                  r={selectedDate === item.date ? 4 : 2.4}
                  fill={colors.good}
                />
                <Circle
                  cx={water[index]!.x}
                  cy={water[index]!.y}
                  r={selectedDate === item.date ? 4 : 2.4}
                  fill="#59b9ff"
                />
                <Rect
                  x={left + (index / count) * plotWidth}
                  y={top}
                  width={plotWidth / count}
                  height={plotHeight}
                  fill="transparent"
                  onPress={() =>
                    setSelectedDate((current) =>
                      current === item.date ? null : item.date,
                    )
                  }
                />
              </Fragment>
            ))}
            {labelIndices.map((index) => (
              <SvgText
                key={index}
                x={x(index)}
                y={height - 7}
                fill={colors.dim}
                fontSize="7"
                textAnchor="middle"
              >
                {format(new Date(`${days[index]!.date}T00:00:00`), "d MMM")}
              </SvgText>
            ))}
          </Svg>
        </View>
      ) : (
        <View style={s.empty}>
          <Ionicons name="nutrition-outline" size={24} color={colors.dim} />
          <Text style={s.muted}>Log nutrition to build your 14-day trend.</Text>
        </View>
      )}
      {selected ? (
        <View style={s.popup}>
          <View style={s.popupHeader}>
            <View style={s.grow}>
              <Text style={s.title}>
                {format(new Date(`${selected.date}T00:00:00`), "EEEE, d MMMM")}
              </Text>
              <Text style={s.muted}>Recorded daily intake</Text>
            </View>
            <Pressable onPress={() => setSelectedDate(null)} hitSlop={8}>
              <Ionicons name="close" size={17} color={colors.dim} />
            </Pressable>
          </View>
          <View style={s.stats}>
            <TrendStat
              color="#f2a65a"
              value={`${Math.round(selected.totals.calories)} kcal`}
              label="Calories"
            />
            <TrendStat
              color={colors.good}
              value={`${Math.round(selected.totals.proteinG)} g`}
              label="Protein"
            />
            <TrendStat
              color="#59b9ff"
              value={`${selected.totals.waterMl} ml`}
              label="Water"
            />
          </View>
          {onOpenDay ? (
            <Pressable
              style={s.openDayButton}
              onPress={() => onOpenDay(selected.date)}
            >
              <Ionicons
                name="calendar-outline"
                size={15}
                color={colors.accent}
              />
              <Text style={s.openDayText}>View this day’s full intake</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </GlassCard>
  );
}

function TrendLegend({ color, label }: { color: string; label: string }) {
  return (
    <View style={s.legendItem}>
      <View style={[s.legendLine, { backgroundColor: color }]} />
      <Text style={s.muted}>{label}</Text>
    </View>
  );
}

function TrendStat({
  color,
  value,
  label,
}: {
  color: string;
  value: string;
  label: string;
}) {
  return (
    <View style={s.stat}>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { padding: spacing.md, gap: spacing.md },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendLine: { width: 18, height: 3, borderRadius: 2 },
  scaleNote: { ...typography.caption, color: colors.dim, textAlign: "center" },
  chart: { marginHorizontal: -spacing.sm },
  empty: {
    minHeight: 150,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  popup: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.field,
    backgroundColor: colors.glass2,
    borderWidth: 1,
    borderColor: colors.glassLine,
  },
  popupHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  grow: { flex: 1 },
  title: { ...typography.caption, color: colors.ink, fontWeight: "700" },
  muted: { ...typography.caption, color: colors.dim },
  stats: { flexDirection: "row", gap: spacing.sm },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingVertical: spacing.sm,
    borderRadius: radius.field,
    backgroundColor: colors.glass,
  },
  statValue: { fontSize: 11, fontWeight: "800" },
  statLabel: { fontSize: 9, color: colors.dim },
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
});
