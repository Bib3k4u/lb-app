"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, Users } from "lucide-react";
import { fetchMembersActivity, fetchRecentCheckIns, fetchTrainerDailyActivity } from "@/lib/api/insights";
import { fetchLocations } from "@/lib/api/org";
import { GlassCard } from "@/components/ui/GlassCard";
import { TextField } from "@/components/ui/TextField";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { DataTable, Column } from "@/components/ui/DataTable";
import { MemberActivity, RecentCheckIn, TrainerDailyActivity } from "@/lib/api/types";

export default function InsightsPage() {
  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const locationsQuery = useQuery({ queryKey: ["locations"], queryFn: fetchLocations });
  const locationOptions = (locationsQuery.data ?? []).map((l) => ({ value: l.id, label: l.name }));

  const range = { locationId: locationId || undefined, from: from || undefined, to: to || undefined };

  const membersQuery = useQuery({
    queryKey: ["insights-members", search, locationId, from, to],
    queryFn: () => fetchMembersActivity({ ...range, search: search || undefined, limit: 50 }),
  });
  const checkInsQuery = useQuery({
    queryKey: ["insights-checkins", locationId, from, to],
    queryFn: () => fetchRecentCheckIns({ ...range, limit: 20 }),
  });
  const trainerDailyQuery = useQuery({
    queryKey: ["insights-trainer-daily", locationId, from, to],
    queryFn: () => fetchTrainerDailyActivity(range),
  });

  const memberColumns: Column<MemberActivity>[] = [
    { header: "Member", render: (m) => m.memberName },
    { header: "Check-ins", render: (m) => m.checkIns },
    { header: "Last check-in", render: (m) => (m.lastCheckInAt ? new Date(m.lastCheckInAt).toLocaleDateString() : "—") },
    { header: "Membership", render: (m) => m.membershipState ?? "—" },
  ];

  const checkInColumns: Column<RecentCheckIn>[] = [
    { header: "Member", render: (c) => c.memberName },
    { header: "Location", render: (c) => c.locationName },
    { header: "When", render: (c) => new Date(c.occurredAt).toLocaleString() },
    { header: "Method", render: (c) => c.method },
  ];

  const trainerColumns: Column<TrainerDailyActivity>[] = [
    { header: "Trainer", render: (t) => t.trainerName },
    { header: "Date", render: (t) => new Date(t.day).toLocaleDateString() },
    { header: "Check-ins", render: (t) => t.checkIns },
    { header: "Workouts completed", render: (t) => t.completedWorkouts },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">Insights</h1>
          <p className="mt-1 text-sm text-lb-ink2">Drill into member activity, attendance and trainer performance.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {locationOptions.length > 1 && (
            <SearchableSelect
              placeholder="All locations"
              options={locationOptions}
              value={locationId}
              onChange={setLocationId}
            />
          )}
          <TextField type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          <TextField type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
      </div>

      <GlassCard>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold">
            <Users className="size-4.5 text-lb-accent" /> Member activity
          </h2>
          <TextField placeholder="Search members…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
        </div>
        <DataTable
          columns={memberColumns}
          rows={membersQuery.data ?? []}
          keyFn={(m) => m.userId}
          loading={membersQuery.isLoading}
          error={membersQuery.isError ? "Couldn't load member activity." : undefined}
          onRetry={() => membersQuery.refetch()}
          emptyIcon={Users}
        />
      </GlassCard>

      <GlassCard>
        <h2 className="mb-4 flex items-center gap-2 font-bold">
          <Activity className="size-4.5 text-lb-accent" /> Recent check-ins
        </h2>
        <DataTable
          columns={checkInColumns}
          rows={checkInsQuery.data ?? []}
          keyFn={(c) => c.id}
          loading={checkInsQuery.isLoading}
          error={checkInsQuery.isError ? "Couldn't load check-ins." : undefined}
          onRetry={() => checkInsQuery.refetch()}
          emptyIcon={Activity}
        />
      </GlassCard>

      <GlassCard>
        <h2 className="mb-4 flex items-center gap-2 font-bold">
          <BarChart3 className="size-4.5 text-lb-accent" /> Trainer daily activity
        </h2>
        <DataTable
          columns={trainerColumns}
          rows={trainerDailyQuery.data ?? []}
          keyFn={(t) => `${t.trainerUserId}-${t.day}`}
          loading={trainerDailyQuery.isLoading}
          error={trainerDailyQuery.isError ? "Couldn't load trainer activity." : undefined}
          onRetry={() => trainerDailyQuery.refetch()}
          emptyIcon={BarChart3}
        />
      </GlassCard>
    </div>
  );
}
