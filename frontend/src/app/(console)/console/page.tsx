"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Building2, CalendarClock, Clock, IndianRupee, RefreshCw, ShieldCheck, Users, XCircle } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { fetchDashboard } from "@/lib/api/insights";
import { fetchAllGyms, fetchPendingGyms, fetchRevenueSummary } from "@/lib/api/platform";
import { fetchLocations } from "@/lib/api/org";
import { StatTile } from "@/components/ui/StatTile";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { BarChart } from "@/components/ui/BarChart";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { TextField } from "@/components/ui/TextField";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { formatMinor } from "@/lib/money";
import { isoToday, shiftIsoDate } from "@/lib/date";

export default function ConsoleDashboardPage() {
  const { user } = useAuth();
  const superAdmin = isSuperAdmin(user?.grants ?? []);

  if (superAdmin) return <SuperAdminDashboard />;
  // Registered but not yet activated (FR-AUTH-16): no grants, so there is no
  // gym-scoped data to show yet — the dashboard's job here is the status.
  if ((user?.grants?.length ?? 0) === 0) return <AwaitingActivation />;
  return <GymDashboard />;
}

const stateCopy: Record<string, { icon: typeof Clock; title: string; body: string }> = {
  PENDING_VERIFICATION: {
    icon: Clock,
    title: "Awaiting verification",
    body: "Our team is reviewing your gym registration. This usually takes under one business day.",
  },
  VERIFIED: {
    icon: ShieldCheck,
    title: "Verified — activating your subscription",
    body: "Your gym has been verified. We're finalizing your subscription, and the rest of your console will unlock shortly.",
  },
  REJECTED: {
    icon: XCircle,
    title: "Registration not approved",
    body: "Your gym registration wasn't approved this time. Please get in touch with LimitBeyond support for details.",
  },
};

function AwaitingActivation() {
  const { user, refresh } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const pendingGym = user?.pendingGym;
  const copy = pendingGym ? stateCopy[pendingGym.state] : undefined;
  const Icon = copy?.icon ?? Clock;

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  return (
    <div className="flex min-h-full items-center justify-center">
      <GlassCard raised className="w-full max-w-sm p-8 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-lb-accent/14 text-lb-accent">
          <Icon className="size-6" />
        </span>
        <h1 className="mt-4 text-xl font-bold">{copy?.title ?? "Checking your gym status"}</h1>
        <p className="mt-2 text-sm text-lb-ink2">
          {copy?.body ?? "We couldn't find a gym registration on your account yet."}
        </p>
        {pendingGym && <p className="mt-4 text-sm font-semibold text-lb-ink">{pendingGym.legalName}</p>}

        <Button onClick={onRefresh} loading={refreshing} variant="ghost" fullWidth className="mt-6">
          <RefreshCw className="size-4" /> Refresh status
        </Button>
      </GlassCard>
    </div>
  );
}

function SuperAdminDashboard() {
  const pendingQuery = useQuery({ queryKey: ["platform-gyms-pending"], queryFn: fetchPendingGyms });
  const allQuery = useQuery({ queryKey: ["platform-gyms-all"], queryFn: fetchAllGyms });
  const revenueQuery = useQuery({ queryKey: ["platform-revenue"], queryFn: fetchRevenueSummary });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-extrabold">Platform overview</h1>
        <p className="mt-1 text-sm text-lb-ink2">Verification queue, gym lifecycle and revenue across LimitBeyond.</p>
      </div>

      <div className="flex flex-wrap gap-4">
        <StatTile label="Pending verification" value={pendingQuery.data?.length ?? "—"} icon={ShieldCheck} accent />
        <StatTile label="Total gyms" value={allQuery.data?.length ?? "—"} icon={Building2} />
        <StatTile
          label="Live gyms"
          value={allQuery.data?.filter((g) => g.state === "LIVE").length ?? "—"}
          icon={Activity}
        />
        <StatTile
          label="Total revenue"
          value={revenueQuery.data ? formatMinor(revenueQuery.data.totalRevenueMinor) : "—"}
          icon={IndianRupee}
        />
        <StatTile
          label="Revenue, last 30 days"
          value={revenueQuery.data ? formatMinor(revenueQuery.data.last30DaysRevenueMinor) : "—"}
          icon={IndianRupee}
          accent
        />
      </div>

      <GlassCard>
        <h2 className="font-bold">Revenue by month</h2>
        <div className="mt-5">
          {revenueQuery.isLoading ? (
            <SkeletonRows rows={2} />
          ) : revenueQuery.isError ? (
            <ErrorState message="Couldn't load revenue." onRetry={() => revenueQuery.refetch()} />
          ) : revenueQuery.data!.monthly.length === 0 ? (
            <EmptyState icon={IndianRupee} title="No subscription payments recorded yet" />
          ) : (
            <BarChart
              data={[...revenueQuery.data!.monthly]
                .reverse()
                .map((m) => ({ label: m.month.slice(5), value: m.amountMinor / 100 }))}
              valueLabel="revenue (₹)"
            />
          )}
        </div>
      </GlassCard>

      <GlassCard>
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Awaiting your review</h2>
          <Link href="/console/gyms" className="text-sm font-semibold text-lb-accent hover:underline">
            View all gyms
          </Link>
        </div>
        <div className="mt-4">
          {pendingQuery.isLoading ? (
            <SkeletonRows rows={3} />
          ) : pendingQuery.isError ? (
            <ErrorState message="Couldn't load pending gyms." onRetry={() => pendingQuery.refetch()} />
          ) : pendingQuery.data!.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="Nothing pending" description="All gym registrations are reviewed." />
          ) : (
            <div className="flex flex-col gap-2">
              {pendingQuery.data!.slice(0, 5).map((gym) => (
                <Link
                  key={gym.id}
                  href="/console/gyms"
                  className="flex items-center justify-between rounded-[var(--radius-lb-field)] px-3 py-2.5 hover:bg-lb-glass"
                >
                  <div>
                    <p className="font-medium">{gym.tradingName ?? gym.legalName}</p>
                    <p className="text-xs text-lb-ink2">
                      {gym.registrant.firstName} {gym.registrant.lastName} · {gym.locations.length} location(s)
                    </p>
                  </div>
                  <Badge tone="accent">Pending</Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

function GymDashboard() {
  const { user } = useAuth();
  const [locationId, setLocationId] = useState("");
  // Default to the last 7 days — the backend's own default (30 days) renders
  // as 30 barely-legible bars, which makes a single recent check-in easy to
  // miss entirely. Still fully overridable via the date pickers below.
  const [from, setFrom] = useState(() => shiftIsoDate(isoToday(), -6));
  const [to, setTo] = useState(() => isoToday());

  const locationsQuery = useQuery({ queryKey: ["locations"], queryFn: fetchLocations });
  const dashboardQuery = useQuery({
    queryKey: ["dashboard", locationId, from, to],
    queryFn: () => fetchDashboard({ locationId: locationId || undefined, from: from || undefined, to: to || undefined }),
  });

  if (dashboardQuery.isLoading) return <SkeletonRows rows={6} />;
  if (dashboardQuery.isError) {
    return <ErrorState message="Couldn't load your dashboard." onRetry={() => dashboardQuery.refetch()} />;
  }

  const data = dashboardQuery.data!;
  const s = data.summary;
  const locationOptions = (locationsQuery.data ?? []).map((l) => ({ value: l.id, label: l.name }));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">
            Welcome back{user?.firstName ? `, ${user.firstName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-lb-ink2">Here&apos;s how your gym is doing.</p>
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

      <div className="flex flex-wrap gap-4">
        <StatTile label="Active members" value={s.activeMembers} icon={Users} accent />
        <StatTile label="Total members" value={s.totalMembers} icon={Users} />
        <StatTile label="Trainers" value={s.totalTrainers} icon={ShieldCheck} />
        <StatTile label="Check-ins" value={s.checkIns} icon={Activity} />
        <StatTile label="Expiring soon" value={s.membershipsExpiringSoon} icon={CalendarClock} />
      </div>

      <GlassCard>
        <h2 className="font-bold">Check-ins over time</h2>
        <div className="mt-5">
          {data.dailyActivity.length === 0 ? (
            <EmptyState icon={Activity} title="No days in this range" />
          ) : data.dailyActivity.every((d) => d.totalCheckIns === 0) ? (
            <EmptyState
              icon={Activity}
              title="No check-ins in this range"
              description={`Nothing recorded between ${data.range.from} and ${data.range.to}. Try widening the date range above.`}
            />
          ) : (
            <BarChart
              data={data.dailyActivity.map((d) => ({ label: d.day.slice(5), value: d.totalCheckIns }))}
              valueLabel="check-ins"
            />
          )}
        </div>
      </GlassCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <GlassCard>
          <h2 className="font-bold">Recent check-ins</h2>
          <div className="mt-3">
            {data.recentCheckIns.length === 0 ? (
              <EmptyState icon={Activity} title="No check-ins yet" />
            ) : (
              <div className="flex flex-col gap-1">
                {data.recentCheckIns.slice(0, 8).map((c) => (
                  <Link
                    key={c.id}
                    href={`/console/roster/${c.userId}`}
                    className="flex items-center justify-between rounded-[var(--radius-lb-field)] px-3 py-2.5 text-sm transition-colors hover:bg-lb-glass"
                  >
                    <span>{c.memberName}</span>
                    <span className="text-xs text-lb-ink2">
                      {new Date(c.occurredAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="font-bold">Trainer activity</h2>
          <div className="mt-3">
            {data.trainers.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="No trainer activity yet" />
            ) : (
              <div className="flex flex-col gap-1">
                {data.trainers.slice(0, 8).map((t) => (
                  <div key={t.userId} className="flex items-center justify-between rounded-[var(--radius-lb-field)] px-3 py-2.5 text-sm hover:bg-lb-glass">
                    <span>{t.trainerName}</span>
                    <span className="text-xs text-lb-ink2">{t.assignedMembers} members</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
