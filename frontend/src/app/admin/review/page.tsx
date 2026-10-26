"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Building2, Check, MapPin, ShieldAlert, X } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { decideByEmailToken } from "@/lib/api/platform";
import { ApiError } from "@/lib/api/types";

interface TokenInfo {
  type: "GYM_REVIEW" | "LOCATION_REVIEW";
  label: string;
  expired: boolean;
}

/** Reads the display fields out of the signed token. This is for showing what
 *  is being reviewed only; the server verifies the signature on every decision. */
function readToken(token: string | null): TokenInfo | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(decodeURIComponent(escape(atob(payload)))) as { t: string; l: string; x: number };
    if (json.t !== "GYM_REVIEW" && json.t !== "LOCATION_REVIEW") return null;
    return { type: json.t, label: json.l, expired: json.x * 1000 < Date.now() };
  } catch {
    return null;
  }
}

function ReviewContent() {
  const params = useSearchParams();
  const token = params.get("t");
  const info = useMemo(() => readToken(token), [token]);

  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(approved: boolean) {
    if (!token) return;
    if (!approved && !reason.trim()) {
      setError("Please add a reason so the owner knows what to fix.");
      return;
    }
    setBusy(approved ? "approve" : "reject");
    setError(null);
    try {
      await decideByEmailToken({ token, approved, reason: approved ? undefined : reason.trim() });
      setDone(approved ? "approved" : "rejected");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const noun = info?.type === "LOCATION_REVIEW" ? "branch" : "gym";
  const Icon = info?.type === "LOCATION_REVIEW" ? MapPin : Building2;

  return (
    <div className="w-full max-w-lg">
      <GlassCard raised className="p-6 text-center sm:p-8">
        {!info || info.expired ? (
          <>
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-lb-alert/15 text-lb-alert">
              <ShieldAlert className="size-6" />
            </span>
            <h1 className="mt-4 text-2xl font-bold">{info?.expired ? "This link has expired" : "This link isn't valid"}</h1>
            <p className="mt-2 text-sm text-lb-ink2">
              {info?.expired
                ? "Review links last 7 days. You can still review it from the console."
                : "Open the latest review email, or review it from the console."}
            </p>
            <Button href="/console/gyms" className="mt-6" fullWidth>
              Open console
            </Button>
          </>
        ) : done ? (
          <>
            <span
              className={`mx-auto flex size-14 items-center justify-center rounded-full ${done === "approved" ? "bg-lb-good/15 text-lb-good" : "bg-lb-alert/15 text-lb-alert"}`}
            >
              {done === "approved" ? <Check className="size-6" /> : <X className="size-6" />}
            </span>
            <h1 className="mt-4 text-2xl font-bold">{done === "approved" ? `${noun[0].toUpperCase()}${noun.slice(1)} approved` : `${noun[0].toUpperCase()}${noun.slice(1)} rejected`}</h1>
            <p className="mt-2 text-sm text-lb-ink2">
              {info.label} {done === "approved" ? "has been approved." : "has been rejected and the owner can fix and resubmit."}
            </p>
            {done === "approved" && noun === "gym" && (
              <p className="mt-3 text-sm text-lb-dim">
                Next, activate their subscription from the console so the gym goes live.
              </p>
            )}
            <Button href="/console/gyms" className="mt-6" fullWidth>
              Open console
            </Button>
          </>
        ) : (
          <>
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-lb-accent/15 text-lb-accent">
              <Icon className="size-6" />
            </span>
            <p className="mt-4 text-xs font-extrabold tracking-[0.16em] text-lb-accent uppercase">Review needed</p>
            <h1 className="mt-1 text-2xl font-bold">{info.label}</h1>
            <p className="mt-2 text-sm text-lb-ink2">
              A new {noun} is waiting for your decision. Check the details in the email, then approve or reject it here.
            </p>

            {rejecting && (
              <label className="mt-5 flex flex-col gap-1.5 text-left">
                <span className="text-[13px] font-medium text-current/70">
                  Reason for rejecting <span className="text-lb-alert">*</span>
                </span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="What should the owner fix?"
                  className="w-full rounded-[var(--radius-lb-field)] border border-current/15 bg-current/[0.04] px-4 py-3 text-[15px] outline-none placeholder:text-current/40 focus:border-lb-accent"
                />
              </label>
            )}

            {error && <p className="mt-4 text-sm text-lb-alert">{error}</p>}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {!rejecting ? (
                <>
                  <Button onClick={() => decide(true)} loading={busy === "approve"} fullWidth size="lg">
                    <Check className="size-4" /> Approve
                  </Button>
                  <Button onClick={() => setRejecting(true)} variant="ghost" fullWidth size="lg" disabled={busy !== null}>
                    <X className="size-4" /> Reject
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={() => decide(false)} loading={busy === "reject"} variant="danger" fullWidth size="lg">
                    Confirm rejection
                  </Button>
                  <Button onClick={() => { setRejecting(false); setError(null); }} variant="ghost" fullWidth size="lg" disabled={busy !== null}>
                    Back
                  </Button>
                </>
              )}
            </div>
            <p className="mt-5 text-xs text-lb-dim">
              Prefer the console? <Link href="/console/gyms" className="font-semibold text-lb-accent underline-offset-4 hover:underline">Open it</Link>
            </p>
          </>
        )}
      </GlassCard>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={null}>
      <ReviewContent />
    </Suspense>
  );
}
