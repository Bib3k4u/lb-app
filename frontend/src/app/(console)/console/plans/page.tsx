"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Pencil, Plus, Trash2 } from "lucide-react";
import { createPlan, deletePlan, fetchPlans, updatePlan } from "@/lib/api/billing";
import { PlanSummary } from "@/lib/api/types";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { formatMinor, rupeesToMinor, minorToRupeesInput } from "@/lib/money";

export default function PlansPage() {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["plans"], queryFn: fetchPlans });
  const [editing, setEditing] = useState<PlanSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const all = query.data ?? [];
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter((p) => p.name.toLowerCase().includes(q));
  }, [query.data, search]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePlan(id),
    onSuccess: () => {
      push("success", "Plan removed.");
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: () => push("error", "Couldn't remove this plan — it may still have members assigned."),
  });

  const columns: Column<PlanSummary>[] = [
    { header: "Plan", render: (p) => <span className="font-semibold">{p.name}</span> },
    { header: "Duration", render: (p) => `${p.durationMonths} mo` },
    { header: "Price", render: (p) => <span className="lb-num">{formatMinor(p.priceMinor, p.currency)}</span> },
    { header: "Members", render: (p) => p.assignedMemberCount },
    {
      header: "Actions",
      render: (p) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
            <Pencil className="size-3.5" /> Edit
          </Button>
          <Button
            size="sm"
            variant="subtle"
            onClick={() => confirm(`Delete ${p.name}?`) && deleteMutation.mutate(p.id)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Plans</h1>
          <p className="mt-1 text-sm text-lb-ink2">Your pricing catalogue, sold at any location.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New plan
        </Button>
      </div>

      <TextField
        label="Search"
        placeholder="Plan name"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-xs"
      />

      <DataTable
        columns={columns}
        rows={rows}
        keyFn={(p) => p.id}
        loading={query.isLoading}
        error={query.isError ? "Couldn't load plans." : undefined}
        onRetry={() => query.refetch()}
        emptyIcon={CreditCard}
        emptyTitle="No plans yet"
        emptyDescription="Create your first pricing plan to start selling memberships."
      />

      {(creating || editing) && (
        <PlanFormModal
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function PlanFormModal({ initial, onClose }: { initial: PlanSummary | null; onClose: () => void }) {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState(initial?.name ?? "");
  const [durationMonths, setDurationMonths] = useState(String(initial?.durationMonths ?? "1"));
  const [price, setPrice] = useState(initial ? minorToRupeesInput(initial.priceMinor) : "");

  const mutation = useMutation({
    mutationFn: () => {
      const input = { name, durationMonths: Number(durationMonths), priceMinor: rupeesToMinor(price) };
      return initial ? updatePlan(initial.id, input) : createPlan(input).then(() => undefined);
    },
    onSuccess: () => {
      push("success", initial ? "Plan updated." : "Plan created.");
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      onClose();
    },
    onError: () => push("error", "Couldn't save this plan."),
  });

  return (
    <Modal open onClose={onClose} title={initial ? "Edit plan" : "New plan"}>
      <div className="flex flex-col gap-4">
        <TextField label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <TextField
          label="Duration (months)"
          type="number"
          min={1}
          required
          value={durationMonths}
          onChange={(e) => setDurationMonths(e.target.value)}
        />
        <TextField
          label="Price (₹)"
          type="number"
          min={0}
          required
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          hint="Stored as exact paise — no rounding."
        />
        <Button fullWidth size="lg" loading={mutation.isPending} onClick={() => mutation.mutate()}>
          {initial ? "Save changes" : "Create plan"}
        </Button>
      </div>
    </Modal>
  );
}
