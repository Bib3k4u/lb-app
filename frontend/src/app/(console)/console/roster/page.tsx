"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { deactivatePerson, fetchRoster, reactivatePerson } from "@/lib/api/roster";
import { fetchLocations } from "@/lib/api/org";
import { PersonSummary, Role } from "@/lib/api/types";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { useToast } from "@/components/ui/Toast";

const roleFilters = [
  { value: "ALL", label: "All" },
  { value: "MEMBER", label: "Members" },
  { value: "TRAINER", label: "Trainers" },
  { value: "LOCATION_ADMIN", label: "Location Admins" },
];

const stateTone: Record<string, "good" | "alert" | "accent"> = {
  ACTIVE: "good",
  PENDING_VERIFICATION: "accent",
  SUSPENDED: "alert",
  REJECTED: "alert",
};

export default function RosterPage() {
  const router = useRouter();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [locationFilter, setLocationFilter] = useState("");

  const query = useQuery({ queryKey: ["roster"], queryFn: fetchRoster });
  const locationsQuery = useQuery({ queryKey: ["locations"], queryFn: fetchLocations });

  const filtered = useMemo(() => {
    let rows = query.data ?? [];
    if (roleFilter !== "ALL") rows = rows.filter((r) => r.role === roleFilter);
    if (locationFilter) rows = rows.filter((r) => r.gymWide || r.locationIds.includes(locationFilter));
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          `${r.firstName} ${r.lastName}`.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q) ||
          r.phoneE164?.includes(q),
      );
    }
    return rows;
  }, [query.data, roleFilter, locationFilter, search]);

  const locationOptions = (locationsQuery.data ?? []).map((l) => ({ value: l.id, label: l.name }));

  const toggleMutation = useMutation({
    mutationFn: ({ userId, role, activate }: { userId: string; role: Role; activate: boolean }) =>
      activate ? reactivatePerson(userId, role) : deactivatePerson(userId, role),
    onSuccess: () => {
      push("success", "Updated.");
      queryClient.invalidateQueries({ queryKey: ["roster"] });
    },
    onError: () => push("error", "Couldn't update this person."),
  });

  const columns: Column<PersonSummary>[] = [
    {
      header: "Name",
      render: (p) => (
        <div>
          <p className="font-semibold">
            {p.firstName} {p.lastName}
          </p>
          <p className="text-xs text-lb-ink2">{p.email ?? p.phoneE164}</p>
        </div>
      ),
    },
    { header: "Role", render: (p) => <Badge tone="accent">{p.role.replace(/_/g, " ")}</Badge> },
    {
      header: "Membership",
      render: (p) => (p.membership ? p.membership.planName : <span className="text-lb-ink2">—</span>),
    },
    {
      header: "Trainer",
      render: (p) =>
        p.assignedTrainer ? (
          `${p.assignedTrainer.firstName} ${p.assignedTrainer.lastName}`
        ) : (
          <span className="text-lb-ink2">Unassigned</span>
        ),
    },
    { header: "Status", render: (p) => <Badge tone={stateTone[p.accountState]}>{p.accountState.replace(/_/g, " ")}</Badge> },
    {
      header: "Actions",
      render: (p) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => router.push(`/console/roster/${p.userId}`)}>
            View
          </Button>
          {p.accountState === "ACTIVE" ? (
            <Button
              size="sm"
              variant="subtle"
              onClick={() => toggleMutation.mutate({ userId: p.userId, role: p.role, activate: false })}
            >
              Deactivate
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => toggleMutation.mutate({ userId: p.userId, role: p.role, activate: true })}
            >
              Reactivate
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold">Roster</h1>
        <p className="mt-1 text-sm text-lb-ink2">Everyone with access at your gym.</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <TextField
          label="Search"
          placeholder="Name, email or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <div className="flex flex-wrap items-end gap-3">
          {locationOptions.length > 1 && (
            <SearchableSelect
              placeholder="All locations"
              options={locationOptions}
              value={locationFilter}
              onChange={setLocationFilter}
            />
          )}
          <ChipGroup options={roleFilters} value={roleFilter} onChange={setRoleFilter} />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        keyFn={(p) => p.userId}
        loading={query.isLoading}
        error={query.isError ? "Couldn't load the roster." : undefined}
        onRetry={() => query.refetch()}
        emptyIcon={Users}
        emptyTitle="No one here yet"
      />
    </div>
  );
}
