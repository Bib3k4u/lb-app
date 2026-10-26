"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAllStates, getDistricts } from "india-state-district";
import { Download, MapPin, Pencil, Plus, QrCode as QrCodeIcon, Trash2 } from "lucide-react";
import {
  createLocation,
  decideLocationVerification,
  deleteLocation,
  fetchLocationQrToken,
  fetchLocationReviewQueue,
  fetchLocations,
  updateLocation,
} from "@/lib/api/org";
import { LocationInput, LocationSummary } from "@/lib/api/types";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { QrCode } from "@/components/ui/QrCode";
import { ErrorState } from "@/components/ui/ErrorState";
import { useToast } from "@/components/ui/Toast";
import { slugify } from "@/lib/slugify";
import { buildLocationQrPayload } from "@/lib/qrPayload";

const states = getAllStates();
const stateOptions = states.map((s) => ({ value: s.code, label: s.name }));
const stateFilterOptions = states.map((s) => ({ value: s.name, label: s.name }));

const approvalTone: Record<string, "good" | "alert" | "accent"> = {
  APPROVED: "good",
  PENDING_VERIFICATION: "accent",
  REJECTED: "alert",
};

export default function LocationsPage() {
  const [tab, setTab] = useState<"all" | "queue">("all");
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<LocationSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<LocationSummary | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [qrTarget, setQrTarget] = useState<LocationSummary | null>(null);

  const allQuery = useQuery({ queryKey: ["locations"], queryFn: fetchLocations });
  const queueQuery = useQuery({ queryKey: ["locations-queue"], queryFn: fetchLocationReviewQueue, enabled: tab === "queue" });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["locations"] });
    queryClient.invalidateQueries({ queryKey: ["locations-queue"] });
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLocation(id),
    onSuccess: () => {
      push("success", "Location removed.");
      invalidate();
    },
    onError: () => push("error", "Couldn't remove this location."),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => decideLocationVerification(id, { approved: true }),
    onSuccess: () => {
      push("success", "Location approved.");
      invalidate();
    },
    onError: () => push("error", "Couldn't approve this location."),
  });

  const rejectMutation = useMutation({
    mutationFn: () => decideLocationVerification(rejectTarget!.id, { approved: false, reason: rejectReason }),
    onSuccess: () => {
      push("success", "Location rejected.");
      setRejectTarget(null);
      setRejectReason("");
      invalidate();
    },
    onError: () => push("error", "Couldn't reject this location."),
  });

  const columns: Column<LocationSummary>[] = [
    {
      header: "Location",
      render: (loc) => (
        <div>
          <p className="font-semibold">{loc.name}</p>
          <p className="text-xs text-lb-ink2">
            {loc.city}, {loc.state}
          </p>
        </div>
      ),
    },
    { header: "Radius", render: (loc) => `${loc.checkinRadiusM}m` },
    { header: "Status", render: (loc) => <Badge tone={approvalTone[loc.approvalState]}>{loc.approvalState.replace(/_/g, " ")}</Badge> },
    {
      header: "Actions",
      render: (loc) =>
        tab === "all" ? (
          <div className="flex gap-2">
            {loc.approvalState === "APPROVED" && (
              <Button size="sm" variant="ghost" onClick={() => setQrTarget(loc)}>
                <QrCodeIcon className="size-3.5" /> QR
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setEditing(loc)}>
              <Pencil className="size-3.5" /> Edit
            </Button>
            <Button
              size="sm"
              variant="subtle"
              onClick={() => confirm(`Remove ${loc.name}?`) && deleteMutation.mutate(loc.id)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => approveMutation.mutate(loc.id)} loading={approveMutation.isPending}>
              Approve
            </Button>
            <Button size="sm" variant="danger" onClick={() => setRejectTarget(loc)}>
              Reject
            </Button>
          </div>
        ),
    },
  ];

  const loading = tab === "all" ? allQuery.isLoading : queueQuery.isLoading;
  const isError = tab === "all" ? allQuery.isError : queueQuery.isError;

  const rows = useMemo(() => {
    let filtered = tab === "all" ? allQuery.data ?? [] : queueQuery.data ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((l) => l.name.toLowerCase().includes(q) || l.city.toLowerCase().includes(q));
    }
    if (stateFilter) filtered = filtered.filter((l) => l.state === stateFilter);
    return filtered;
  }, [tab, allQuery.data, queueQuery.data, search, stateFilter]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Locations</h1>
          <p className="mt-1 text-sm text-lb-ink2">Every branch your gym operates.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" /> Add location
        </Button>
      </div>

      <Tabs
        tabs={[
          { key: "all", label: "All locations" },
          { key: "queue", label: "Review queue", count: queueQuery.data?.length },
        ]}
        active={tab}
        onChange={(k) => setTab(k as "all" | "queue")}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <TextField
          label="Search"
          placeholder="Name or city"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <SearchableSelect label="State" placeholder="Any state" options={stateFilterOptions} value={stateFilter} onChange={setStateFilter} />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        keyFn={(l) => l.id}
        loading={loading}
        error={isError ? "Couldn't load locations." : undefined}
        onRetry={() => (tab === "all" ? allQuery.refetch() : queueQuery.refetch())}
        emptyIcon={MapPin}
        emptyTitle={tab === "all" ? "No locations yet" : "Nothing pending"}
      />

      {(creating || editing) && (
        <LocationFormModal
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSuccess={invalidate}
        />
      )}

      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)} title="Reject location">
        <TextField label="Reason" required value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
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

      {qrTarget && <LocationQrModal location={qrTarget} onClose={() => setQrTarget(null)} />}
    </div>
  );
}

function LocationQrModal({ location, onClose }: { location: LocationSummary; onClose: () => void }) {
  const query = useQuery({
    queryKey: ["location-qr", location.id],
    queryFn: () => fetchLocationQrToken(location.id),
    staleTime: Infinity,
  });

  const payload = query.data ? buildLocationQrPayload(location.id, query.data.token) : null;

  function download() {
    if (!payload) return;
    QRCodeToDataUrl(payload).then((url) => {
      const a = document.createElement("a");
      a.href = url;
      a.download = `${location.slug}-checkin-qr.png`;
      a.click();
    });
  }

  return (
    <Modal open onClose={onClose} title="Location check-in QR">
      <p className="mb-4 text-sm text-lb-ink2">
        Print this and post it at <span className="font-semibold text-lb-ink">{location.name}</span> — members scan
        it with the LimitBeyond app to check in.
      </p>
      {query.isLoading ? (
        <div className="flex justify-center py-8">
          <div className="lb-skeleton size-56 rounded-[var(--radius-lb-field)]" />
        </div>
      ) : query.isError ? (
        <ErrorState message="Couldn't load this location's QR code." onRetry={() => query.refetch()} />
      ) : payload ? (
        <>
          <div className="flex justify-center rounded-[var(--radius-lb-field)] bg-white p-5">
            <QrCode value={payload} size={220} />
          </div>
          <Button fullWidth className="mt-4" variant="ghost" onClick={download}>
            <Download className="size-4" /> Download PNG
          </Button>
        </>
      ) : null}
    </Modal>
  );
}

async function QRCodeToDataUrl(value: string): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(value, { width: 512, margin: 2, errorCorrectionLevel: "H" });
}

function LocationFormModal({
  initial,
  onClose,
  onSuccess,
}: {
  initial: LocationSummary | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { push } = useToast();
  const [name, setName] = useState(initial?.name ?? "");
  const [addressLine1, setAddressLine1] = useState(initial?.addressLine1 ?? "");
  const [addressLine2, setAddressLine2] = useState(initial?.addressLine2 ?? "");
  const stateCodeFromName = states.find((s) => s.name === initial?.state)?.code ?? "";
  const [stateCode, setStateCode] = useState(stateCodeFromName);
  const [city, setCity] = useState(initial?.city ?? "");
  const [pincode, setPincode] = useState(initial?.pincode ?? "");
  const [phoneE164, setPhoneE164] = useState(initial?.phoneE164 ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initial ? { lat: initial.latitude, lng: initial.longitude } : null,
  );

  const cityOptions = useMemo(
    () => (stateCode ? getDistricts(stateCode).map((d) => ({ value: d, label: d })) : []),
    [stateCode],
  );

  const mutation = useMutation({
    mutationFn: () => {
      const stateName = states.find((s) => s.code === stateCode)?.name ?? stateCode;
      const input: LocationInput = {
        slug: initial?.slug ?? slugify(name),
        name,
        addressLine1,
        addressLine2: addressLine2 || undefined,
        city,
        state: stateName,
        pincode,
        latitude: coords?.lat ?? 0,
        longitude: coords?.lng ?? 0,
        phoneE164: phoneE164 || undefined,
      };
      return initial ? updateLocation(initial.id, input) : createLocation(input).then(() => undefined);
    },
    onSuccess: () => {
      push("success", initial ? "Location updated." : "Location added.");
      onSuccess();
      onClose();
    },
    onError: () => push("error", "Couldn't save this location."),
  });

  function captureLocation() {
    navigator.geolocation?.getCurrentPosition((pos) =>
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    );
  }

  return (
    <Modal open onClose={onClose} title={initial ? "Edit location" : "Add location"}>
      <div className="flex flex-col gap-4">
        <TextField label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Address line 1" required value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
        <TextField label="Address line 2" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <SearchableSelect
            label="State"
            options={stateOptions}
            value={stateCode}
            onChange={(v) => {
              setStateCode(v);
              setCity("");
            }}
          />
          <SearchableSelect label="City" options={cityOptions} value={city} onChange={setCity} disabled={!stateCode} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Pincode" required value={pincode} onChange={(e) => setPincode(e.target.value)} />
          <TextField label="Phone" value={phoneE164} onChange={(e) => setPhoneE164(e.target.value)} />
        </div>
        <Button type="button" variant="ghost" onClick={captureLocation}>
          <MapPin className="size-4" /> {coords ? "Recapture GPS" : "Capture GPS location"}
        </Button>
        <Button fullWidth size="lg" loading={mutation.isPending} onClick={() => mutation.mutate()}>
          {initial ? "Save changes" : "Add location"}
        </Button>
      </div>
    </Modal>
  );
}
