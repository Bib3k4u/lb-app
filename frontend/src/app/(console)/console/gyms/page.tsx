"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { getAllStates } from "india-state-district";
import { Building2, Check, X } from "lucide-react";
import {
  closeGym,
  deactivateGym,
  decideGymVerification,
  fetchAllGyms,
  fetchDefaultSubscriptionOffering,
  fetchPendingGyms,
  reactivateGym,
  recordSubscriptionPayment,
} from "@/lib/api/platform";
import { ApiError, GymSummary } from "@/lib/api/types";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { useToast } from "@/components/ui/Toast";
import { formatMinor, rupeesToMinor } from "@/lib/money";
import { isoToday } from "@/lib/date";

const stateOptions = getAllStates().map((s) => ({ value: s.name, label: s.name }));

const stateTone: Record<string, "good" | "alert" | "accent" | "neutral"> = {
  LIVE: "good",
  VERIFIED: "accent",
  PENDING_VERIFICATION: "accent",
  SUSPENDED: "alert",
  REJECTED: "alert",
  CLOSED: "neutral",
};

export default function GymsPage() {
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const { push } = useToast();
  const queryClient = useQueryClient();

  const pendingQuery = useQuery({ queryKey: ["platform-gyms-pending"], queryFn: fetchPendingGyms });
  const allQuery = useQuery({ queryKey: ["platform-gyms-all"], queryFn: fetchAllGyms, enabled: tab === "all" });

  const [rejectTarget, setRejectTarget] = useState<GymSummary | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [paymentTarget, setPaymentTarget] = useState<GymSummary | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<GymSummary | null>(null);
  const [deactivateReason, setDeactivateReason] = useState("");

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["platform-gyms-pending"] });
    queryClient.invalidateQueries({ queryKey: ["platform-gyms-all"] });
  }

  function errorMessage(err: unknown, fallback: string) {
    return err instanceof ApiError ? err.message : fallback;
  }

  const approveMutation = useMutation({
    mutationFn: (gymId: string) => decideGymVerification(gymId, { approved: true }),
    onSuccess: () => {
      push("success", "Gym verified.");
      invalidate();
    },
    onError: (err) => {
      push("error", errorMessage(err, "Couldn't verify this gym."));
      invalidate();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => decideGymVerification(rejectTarget!.id, { approved: false, reason: rejectReason }),
    onSuccess: () => {
      push("success", "Registration rejected.");
      setRejectTarget(null);
      setRejectReason("");
      invalidate();
    },
    onError: (err) => {
      push("error", errorMessage(err, "Couldn't reject this registration."));
      invalidate();
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () => deactivateGym(deactivateTarget!.id, deactivateReason),
    onSuccess: () => {
      push("success", "Gym suspended.");
      setDeactivateTarget(null);
      setDeactivateReason("");
      invalidate();
    },
    onError: (err) => {
      push("error", errorMessage(err, "Couldn't suspend this gym."));
      invalidate();
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (gymId: string) => reactivateGym(gymId),
    onSuccess: () => {
      push("success", "Gym reactivated.");
      invalidate();
    },
    onError: (err) => {
      push("error", errorMessage(err, "Couldn't reactivate this gym."));
      invalidate();
    },
  });

  const closeMutation = useMutation({
    mutationFn: (gymId: string) => closeGym(gymId),
    onSuccess: () => {
      push("success", "Gym closed.");
      invalidate();
    },
    onError: (err) => {
      push("error", errorMessage(err, "Couldn't close this gym."));
      invalidate();
    },
  });

  const columns: Column<GymSummary>[] = [
    {
      header: "Gym",
      render: (gym) => (
        <Link href={`/console/gyms/${gym.id}`} className="font-semibold hover:text-lb-accent">
          {gym.tradingName ?? gym.legalName}
        </Link>
      ),
    },
    {
      header: "Registrant",
      render: (gym) => (
        <span className="text-lb-ink2">
          {gym.registrant.firstName} {gym.registrant.lastName}
        </span>
      ),
    },
    { header: "Locations", render: (gym) => gym.locations.length },
    { header: "Status", render: (gym) => <Badge tone={stateTone[gym.state]}>{gym.state.replace(/_/g, " ")}</Badge> },
    {
      header: "Actions",
      render: (gym) => (
        <div className="flex flex-wrap gap-2">
          {gym.state === "PENDING_VERIFICATION" && (
            <>
              <Button size="sm" onClick={() => approveMutation.mutate(gym.id)} loading={approveMutation.isPending}>
                <Check className="size-3.5" /> Approve
              </Button>
              <Button size="sm" variant="danger" onClick={() => setRejectTarget(gym)}>
                <X className="size-3.5" /> Reject
              </Button>
            </>
          )}
          {gym.state === "VERIFIED" && (
            <Button size="sm" onClick={() => setPaymentTarget(gym)}>
              Record payment
            </Button>
          )}
          {gym.state === "LIVE" && (
            <Button size="sm" variant="ghost" onClick={() => setDeactivateTarget(gym)}>
              Suspend
            </Button>
          )}
          {gym.state === "SUSPENDED" && (
            <Button size="sm" onClick={() => reactivateMutation.mutate(gym.id)} loading={reactivateMutation.isPending}>
              Reactivate
            </Button>
          )}
          {gym.state !== "CLOSED" && (
            <Button
              size="sm"
              variant="subtle"
              onClick={() => {
                if (confirm(`Permanently close ${gym.legalName}?`)) closeMutation.mutate(gym.id);
              }}
            >
              Close
            </Button>
          )}
        </div>
      ),
    },
  ];

  const loading = tab === "pending" ? pendingQuery.isLoading : allQuery.isLoading;
  const isError = tab === "pending" ? pendingQuery.isError : allQuery.isError;

  const rows = useMemo(() => {
    let filtered = tab === "pending" ? pendingQuery.data ?? [] : allQuery.data ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (g) => g.legalName.toLowerCase().includes(q) || g.tradingName?.toLowerCase().includes(q),
      );
    }
    if (stateFilter) {
      filtered = filtered.filter((g) => g.locations.some((loc) => loc.state === stateFilter));
    }
    return filtered;
  }, [tab, pendingQuery.data, allQuery.data, search, stateFilter]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold">Gyms</h1>
        <p className="mt-1 text-sm text-lb-ink2">Verify registrations and manage gym lifecycle across the platform.</p>
      </div>

      <Tabs
        tabs={[
          { key: "pending", label: "Pending", count: pendingQuery.data?.length },
          { key: "all", label: "All gyms" },
        ]}
        active={tab}
        onChange={(k) => setTab(k as "pending" | "all")}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <TextField
          label="Search"
          placeholder="Gym name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <SearchableSelect label="State" placeholder="Any state" options={stateOptions} value={stateFilter} onChange={setStateFilter} />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        keyFn={(g) => g.id}
        loading={loading}
        error={isError ? "Couldn't load gyms." : undefined}
        onRetry={() => (tab === "pending" ? pendingQuery.refetch() : allQuery.refetch())}
        emptyIcon={Building2}
        emptyTitle={tab === "pending" ? "Nothing pending" : "No gyms yet"}
      />

      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)} title="Reject registration">
        <p className="mb-4 text-sm text-lb-ink2">A reason is required — it&apos;s shown to the registrant.</p>
        <TextField
          label="Reason"
          required
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
        <Button
          className="mt-4"
          fullWidth
          variant="danger"
          disabled={!rejectReason}
          loading={rejectMutation.isPending}
          onClick={() => rejectMutation.mutate()}
        >
          Confirm rejection
        </Button>
      </Modal>

      <Modal open={!!deactivateTarget} onClose={() => setDeactivateTarget(null)} title="Suspend gym">
        <TextField
          label="Reason"
          required
          value={deactivateReason}
          onChange={(e) => setDeactivateReason(e.target.value)}
        />
        <Button
          className="mt-4"
          fullWidth
          variant="danger"
          disabled={!deactivateReason}
          loading={deactivateMutation.isPending}
          onClick={() => deactivateMutation.mutate()}
        >
          Confirm suspension
        </Button>
      </Modal>

      {paymentTarget && (
        <PaymentModal gym={paymentTarget} onClose={() => setPaymentTarget(null)} onSuccess={invalidate} />
      )}
    </div>
  );
}

function PaymentModal({ gym, onClose, onSuccess }: { gym: GymSummary; onClose: () => void; onSuccess: () => void }) {
  const { push } = useToast();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const offeringQuery = useQuery({ queryKey: ["default-offering"], queryFn: fetchDefaultSubscriptionOffering });
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [receivedOn, setReceivedOn] = useState(isoToday());

  const mutation = useMutation({
    mutationFn: () =>
      recordSubscriptionPayment(
        gym.id,
        {
          offeringId: offeringQuery.data!.id,
          amountMinor: rupeesToMinor(amount || String((offeringQuery.data?.priceMinor ?? 0) / 100)),
          method,
          reference: reference || undefined,
          receivedOn,
        },
        idempotencyKey,
      ),
    onSuccess: () => {
      push("success", "Payment recorded — gym is now live.");
      onSuccess();
      onClose();
    },
    onError: () => push("error", "Couldn't record this payment."),
  });

  return (
    <Modal open onClose={onClose} title={`Record payment — ${gym.legalName}`}>
      {offeringQuery.data && (
        <p className="mb-4 text-sm text-lb-ink2">
          Default offering: {offeringQuery.data.name} ({formatMinor(offeringQuery.data.priceMinor)})
        </p>
      )}
      <div className="flex flex-col gap-4">
        <TextField
          label={`Amount (₹) — default ${formatMinor(offeringQuery.data?.priceMinor ?? 0)}`}
          placeholder={String((offeringQuery.data?.priceMinor ?? 0) / 100)}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <ChipGroup
          label="Method"
          options={["CASH", "UPI", "CARD", "BANK_TRANSFER", "CHEQUE"].map((m) => ({ value: m, label: m.replace(/_/g, " ") }))}
          value={method}
          onChange={setMethod}
        />
        <TextField label="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} />
        <TextField label="Received on" type="date" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} />
        <Button fullWidth loading={mutation.isPending} disabled={!offeringQuery.data} onClick={() => mutation.mutate()}>
          Record payment
        </Button>
      </div>
    </Modal>
  );
}
