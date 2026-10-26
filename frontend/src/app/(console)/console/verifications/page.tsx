"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { decideVerification, fetchPendingVerifications } from "@/lib/api/auth";
import { fetchPlans } from "@/lib/api/billing";
import { PersonSummary } from "@/lib/api/types";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { useToast } from "@/components/ui/Toast";

const roleFilters = [
  { value: "ALL", label: "All" },
  { value: "MEMBER", label: "Members" },
  { value: "TRAINER", label: "Trainers" },
];

export default function VerificationsPage() {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["verifications"], queryFn: fetchPendingVerifications });
  const plansQuery = useQuery({ queryKey: ["plans"], queryFn: fetchPlans });
  const [roleFilter, setRoleFilter] = useState("ALL");

  const rows = useMemo(() => {
    const all = query.data ?? [];
    return roleFilter === "ALL" ? all : all.filter((p) => p.role === roleFilter);
  }, [query.data, roleFilter]);

  const [approveTarget, setApproveTarget] = useState<PersonSummary | null>(null);
  const [planId, setPlanId] = useState("");
  const [rejectTarget, setRejectTarget] = useState<PersonSummary | null>(null);
  const [reason, setReason] = useState("");

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["verifications"] });
    queryClient.invalidateQueries({ queryKey: ["roster"] });
  }

  const approveMutation = useMutation({
    mutationFn: () => decideVerification(approveTarget!.userId, { approved: true, planId: planId || undefined }),
    onSuccess: () => {
      push("success", "Approved.");
      setApproveTarget(null);
      setPlanId("");
      invalidate();
    },
    onError: () => push("error", "Couldn't approve this person."),
  });

  const rejectMutation = useMutation({
    mutationFn: () => decideVerification(rejectTarget!.userId, { approved: false, reason }),
    onSuccess: () => {
      push("success", "Rejected.");
      setRejectTarget(null);
      setReason("");
      invalidate();
    },
    onError: () => push("error", "Couldn't reject this person."),
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
    { header: "Requested", render: (p) => new Date(p.grantedAt).toLocaleDateString() },
    {
      header: "Actions",
      render: (p) => (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setApproveTarget(p)}>
            Approve
          </Button>
          <Button size="sm" variant="danger" onClick={() => setRejectTarget(p)}>
            Reject
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold">Verifications</h1>
        <p className="mt-1 text-sm text-lb-ink2">New members and trainers waiting for approval.</p>
      </div>

      <ChipGroup options={roleFilters} value={roleFilter} onChange={setRoleFilter} />

      <DataTable
        columns={columns}
        rows={rows}
        keyFn={(p) => p.userId}
        loading={query.isLoading}
        error={query.isError ? "Couldn't load pending verifications." : undefined}
        onRetry={() => query.refetch()}
        emptyIcon={ShieldCheck}
        emptyTitle="Nothing pending"
        emptyDescription="New sign-ups will show up here for approval."
      />

      <Modal open={!!approveTarget} onClose={() => setApproveTarget(null)} title="Approve">
        <p className="mb-4 text-sm text-lb-ink2">
          Approving {approveTarget?.firstName} {approveTarget?.lastName} as {approveTarget?.role.toLowerCase()}.
        </p>
        {approveTarget?.role === "MEMBER" && plansQuery.data && plansQuery.data.length > 0 && (
          <div className="mb-4">
            <SearchableSelect
              label="Assign a plan (optional)"
              placeholder="No plan"
              options={plansQuery.data.map((plan) => ({ value: plan.id, label: plan.name }))}
              value={planId}
              onChange={setPlanId}
            />
          </div>
        )}
        <Button fullWidth loading={approveMutation.isPending} onClick={() => approveMutation.mutate()}>
          Confirm approval
        </Button>
      </Modal>

      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)} title="Reject">
        <TextField label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button
          className="mt-4"
          fullWidth
          variant="danger"
          disabled={!reason}
          loading={rejectMutation.isPending}
          onClick={() => rejectMutation.mutate()}
        >
          Confirm rejection
        </Button>
      </Modal>
    </div>
  );
}
