"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dumbbell, Plus, Ruler, Trophy } from "lucide-react";
import { addProgressMetric, fetchProgress } from "@/lib/api/training";
import { MetricType } from "@/lib/api/types";
import { isoToday } from "@/lib/date";
import { StatTile } from "@/components/ui/StatTile";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { TextField } from "@/components/ui/TextField";
import { BarChart } from "@/components/ui/BarChart";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

const METRIC_TYPES: { value: MetricType; label: string }[] = [
  { value: "WEIGHT_KG", label: "Weight" },
  { value: "BODY_FAT_PCT", label: "Body fat %" },
  { value: "CHEST_CM", label: "Chest" },
  { value: "WAIST_CM", label: "Waist" },
  { value: "HIP_CM", label: "Hip" },
  { value: "ARM_CM", label: "Arm" },
  { value: "THIGH_CM", label: "Thigh" },
  { value: "NECK_CM", label: "Neck" },
];

const METRIC_LABELS: Record<MetricType, string> = Object.fromEntries(
  METRIC_TYPES.map((m) => [m.value, m.label]),
) as Record<MetricType, string>;

const DEFAULT_UNITS: Record<MetricType, string> = {
  WEIGHT_KG: "kg",
  BODY_FAT_PCT: "%",
  CHEST_CM: "cm",
  WAIST_CM: "cm",
  HIP_CM: "cm",
  ARM_CM: "cm",
  THIGH_CM: "cm",
  NECK_CM: "cm",
};

export function PerformanceTab({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [metricType, setMetricType] = useState<MetricType>("WEIGHT_KG");
  const [recording, setRecording] = useState(false);

  const progressQuery = useQuery({ queryKey: ["progress", userId], queryFn: () => fetchProgress(userId) });

  if (progressQuery.isLoading) return <SkeletonRows rows={5} />;
  if (progressQuery.isError) {
    return <ErrorState message="Couldn't load performance." onRetry={() => progressQuery.refetch()} />;
  }

  const data = progressQuery.data!;
  const metricSeries = data.metrics
    .filter((m) => m.metricType === metricType)
    .sort((a, b) => a.recordedOn.localeCompare(b.recordedOn));

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["progress", userId] });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-4">
        <StatTile label="Workouts" value={data.workoutCount} icon={Dumbbell} accent />
        <StatTile label="Personal records" value={data.personalRecords.length} icon={Trophy} />
        <StatTile label="Measurements" value={data.metrics.length} icon={Ruler} />
      </div>

      <GlassCard>
        <h3 className="font-bold">Personal records</h3>
        <div className="mt-3">
          {data.personalRecords.length === 0 ? (
            <EmptyState icon={Trophy} title="No personal records yet" />
          ) : (
            <div className="flex flex-col gap-1">
              {data.personalRecords.map((pr) => (
                <div
                  key={pr.exerciseId}
                  className="flex items-center justify-between rounded-[var(--radius-lb-field)] px-3 py-2.5 text-sm hover:bg-lb-glass"
                >
                  <div className="flex items-center gap-2.5">
                    <Trophy className="size-4 text-lb-accent" />
                    <div>
                      <p className="font-medium">{pr.exerciseName}</p>
                      <p className="text-xs text-lb-ink2">{new Date(pr.achievedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className="lb-num text-xs text-lb-ink2">
                    {pr.maxWeightKg != null ? `${pr.maxWeightKg}kg` : ""}
                    {pr.maxReps != null ? ` · ${pr.maxReps} reps` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </GlassCard>

      <GlassCard>
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Body measurements</h3>
          <Button size="sm" variant="ghost" onClick={() => setRecording((v) => !v)}>
            <Plus className="size-4" /> Record
          </Button>
        </div>

        {recording && (
          <RecordMetricForm
            userId={userId}
            onSaved={() => {
              setRecording(false);
              invalidate();
            }}
          />
        )}

        <div className="mt-4">
          <ChipGroup options={METRIC_TYPES} value={metricType} onChange={(v) => setMetricType(v as MetricType)} />
        </div>
        <div className="mt-4">
          {metricSeries.length === 0 ? (
            <EmptyState icon={Ruler} title="No measurements of this type yet" />
          ) : (
            <BarChart
              data={metricSeries.map((m) => ({ label: m.recordedOn.slice(5), value: m.value }))}
              valueLabel={METRIC_LABELS[metricType]}
            />
          )}
        </div>

        {data.metrics.length > 0 && (
          <div className="mt-4 flex flex-col gap-1 border-t border-lb-glass-line pt-3">
            {[...data.metrics]
              .sort((a, b) => b.recordedOn.localeCompare(a.recordedOn))
              .slice(0, 12)
              .map((m) => (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <span className="text-lb-ink2">
                    {METRIC_LABELS[m.metricType]} · {new Date(m.recordedOn).toLocaleDateString()}
                  </span>
                  <span className="lb-num">
                    {m.value} {m.unit}
                  </span>
                </div>
              ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function RecordMetricForm({ userId, onSaved }: { userId: string; onSaved: () => void }) {
  const { push } = useToast();
  const [metricType, setMetricType] = useState<MetricType>("WEIGHT_KG");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState(DEFAULT_UNITS.WEIGHT_KG);
  const [recordedOn, setRecordedOn] = useState(isoToday());

  const mutation = useMutation({
    mutationFn: () => addProgressMetric(userId, { metricType, recordedOn, value: Number(value), unit }),
    onSuccess: () => {
      push("success", "Recorded.");
      onSaved();
    },
    onError: () => push("error", "Couldn't save this measurement."),
  });

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-[var(--radius-lb-field)] bg-current/5 p-4">
      <ChipGroup
        options={METRIC_TYPES}
        value={metricType}
        onChange={(v) => {
          setMetricType(v as MetricType);
          setUnit(DEFAULT_UNITS[v as MetricType]);
        }}
      />
      <div className="grid grid-cols-3 gap-3">
        <TextField label="Value" type="number" value={value} onChange={(e) => setValue(e.target.value)} />
        <TextField label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
        <TextField label="Date" type="date" value={recordedOn} onChange={(e) => setRecordedOn(e.target.value)} />
      </div>
      <Button loading={mutation.isPending} disabled={!value} onClick={() => mutation.mutate()}>
        Save measurement
      </Button>
    </div>
  );
}
