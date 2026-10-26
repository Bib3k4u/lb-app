"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { requestPasswordReset, resetPassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/types";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"request" | "reset" | "done">("request");
  const [phoneE164, setPhoneE164] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitRequest(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await requestPasswordReset(phoneE164);
      setStep("reset");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send a reset code.");
    } finally {
      setLoading(false);
    }
  }

  async function submitReset(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await resetPassword({ phoneE164, code, newPassword });
      setStep("done");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That code didn't work. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">

      <GlassCard raised>
        {step === "request" && (
          <>
            <h1 className="text-xl font-bold">Reset your password</h1>
            <p className="mt-1 text-sm text-lb-ink2">We&apos;ll send a code to your registered phone number.</p>
            <form onSubmit={submitRequest} className="mt-6 flex flex-col gap-4">
              <TextField
                label="Phone number"
                placeholder="+919876543210"
                required
                value={phoneE164}
                onChange={(e) => setPhoneE164(e.target.value)}
              />
              {error && <p className="text-sm text-lb-alert">{error}</p>}
              <Button type="submit" loading={loading} fullWidth size="lg">
                Send code
              </Button>
            </form>
          </>
        )}

        {step === "reset" && (
          <>
            <h1 className="text-xl font-bold">Enter the code</h1>
            <p className="mt-1 text-sm text-lb-ink2">Sent to {phoneE164}.</p>
            <form onSubmit={submitReset} className="mt-6 flex flex-col gap-4">
              <TextField
                label="6-digit code"
                inputMode="numeric"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <TextField
                label="New password"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              {error && <p className="text-sm text-lb-alert">{error}</p>}
              <Button type="submit" loading={loading} fullWidth size="lg">
                Reset password
              </Button>
            </form>
          </>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-lb-good/14 text-lb-good">
              <CheckCircle2 className="size-6" />
            </span>
            <p className="font-bold">Password reset</p>
            <p className="text-sm text-lb-ink2">You can now sign in with your new password.</p>
            <Button onClick={() => router.push("/admin/login")} fullWidth size="lg" className="mt-2">
              Back to login
            </Button>
          </div>
        )}

        {step !== "done" && (
          <Link href="/admin/login" className="mt-6 flex items-center justify-center gap-1.5 text-sm text-lb-ink2 hover:text-lb-ink">
            <ArrowLeft className="size-3.5" /> Back to login
          </Link>
        )}
      </GlassCard>
    </div>
  );
}
