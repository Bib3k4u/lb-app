"use client";

import { canUseConsole, isNonAdminWithRoles } from "@/lib/auth/permissions";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, Check, LocateFixed, UserRound } from "lucide-react";
import { getAllStates, getDistricts } from "india-state-district";
import { AuthBusyOverlay } from "@/components/auth/AuthBusyOverlay";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { registerAdminAccount } from "@/lib/api/auth";
import { registerGym } from "@/lib/api/platform";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ApiError } from "@/lib/api/types";
import { slugify } from "@/lib/slugify";

const states = getAllStates();

/** "98765 43210", "+91 98765 43210" or "09876543210" -> "+919876543210"; null if not a valid Indian mobile. */
function toE164(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const national = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
  return /^[6-9]\d{9}$/.test(national) ? `+91${national}` : null;
}

export default function AdminRegisterPage() {
  const router = useRouter();
  const { user, loading: authLoading, login, registerWithGoogle, logout, refresh } = useAuth();
  const [viaGoogleState, setViaGoogle] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const googleEnabled = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
  const [stepState, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — account
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneE164, setPhoneE164] = useState("+91");
  const [password, setPassword] = useState("");

  // Step 2 — gym + first location
  const [legalName, setLegalName] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [gstin, setGstin] = useState("");
  const [gymSlug, setGymSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [locationName, setLocationName] = useState("Main");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [locationPhone, setLocationPhone] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const stateOptions = useMemo(() => states.map((s) => ({ value: s.code, label: s.name })), []);
  const cityOptions = useMemo(
    () => (stateCode ? getDistricts(stateCode).map((d) => ({ value: d, label: d })) : []),
    [stateCode],
  );

  function captureLocation() {
    if (!navigator.geolocation) {
      setError("Location isn't available in this browser. You can continue without it.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setError("Couldn't read your location. You can continue without it.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function onLegalNameChange(value: string) {
    setLegalName(value);
    if (!slugTouched) setGymSlug(slugify(value));
  }

  // Arriving already signed in (e.g. straight from the login page's Google
  // button): existing access goes to the console, an unreviewed gym to its
  // status page, and a fresh account lands directly on the gym details step.
  const hasAccess = canUseConsole(user);
  const turnedAway = isNonAdminWithRoles(user);
  const freshSession = !authLoading && Boolean(user) && !hasAccess && !turnedAway;
  useEffect(() => {
    if (authLoading || !user) return;
    if (hasAccess) {
      router.replace("/console");
    } else if (turnedAway) {
      void logout().finally(() => router.replace("/admin/login?denied=1"));
    }
  }, [authLoading, user, hasAccess, turnedAway, logout, router]);

  const step: 1 | 2 = freshSession ? 2 : stepState;
  const viaGoogle = viaGoogleState || freshSession;
  const accountEmail = email || user?.email || "";

  // Wrong Google account (or just a different email)? Sign out and start again.
  async function switchAccount() {
    await logout();
    router.push("/admin/login");
  }

  async function submitStep1(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await registerAdminAccount({ phoneE164, email, password, firstName, lastName });
      await login(email, password);
      setStep(2);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create your account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Google-first: Google proves the email, so the account step is skipped and
  // the owner goes straight to their gym details.
  async function onGoogleCredential(idToken: string) {
    setGoogleBusy(true);
    setError(null);
    try {
      const me = await registerWithGoogle(idToken);
      // Someone who already has an account is signed in, not registered again:
      // existing access goes to the console, an unreviewed gym to its status page.
      if ((me.grants?.length ?? 0) > 0) {
        router.push("/console");
        return; // stay busy while the console loads
      }
      if (me.pendingGym) {
        router.push("/console");
        return;
      }
      setFirstName(me.firstName ?? "");
      setLastName(me.lastName ?? "");
      setEmail(me.email ?? "");
      setViaGoogle(true);
      setStep(2);
      setGoogleBusy(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Google sign-up failed. Please try again.");
      setGoogleBusy(false);
    }
  }

  async function submitStep2(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!stateCode || !city) {
      setError("Please choose your state and city.");
      return;
    }
    const normalizedPhone = toE164(locationPhone);
    if (!normalizedPhone) {
      setError("Enter a valid 10-digit location phone number.");
      return;
    }
    setLoading(true);
    try {
      const stateName = states.find((s) => s.code === stateCode)?.name ?? stateCode;
      await registerGym({
        slug: gymSlug,
        legalName,
        tradingName: tradingName || undefined,
        gstin: gstin || undefined,
        location: {
          slug: slugify(locationName),
          name: locationName,
          addressLine1,
          addressLine2: addressLine2 || undefined,
          city,
          state: stateName,
          pincode,
          latitude: coords?.lat ?? 0,
          longitude: coords?.lng ?? 0,
          phoneE164: normalizedPhone,
        },
      });
      // ConsoleGuard bounces straight back here if it sees a stale `user`
      // with no pendingGym yet — refresh before navigating so it reads the
      // gym we just created, not the pre-registration snapshot.
      await refresh();
      router.push("/console");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not register your gym. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const steps = [
    { n: 1, label: "Your account", icon: UserRound },
    { n: 2, label: "Your gym", icon: Building2 },
  ] as const;

  return (
    <div className={`w-full ${step === 2 ? "max-w-2xl" : "max-w-lg"}`}>
      <ol className="mb-6 flex items-center justify-center gap-3" aria-label="Registration steps">
        {steps.map(({ n, label, icon: Icon }, i) => (
          <li key={n} className="flex items-center gap-3">
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-full border text-sm font-bold transition-colors ${
                step >= n
                  ? "border-lb-accent bg-lb-accent text-lb-on-accent"
                  : "border-lb-glass-line-2 text-lb-dim"
              }`}
            >
              <Icon className="size-4" />
            </span>
            <span className={`text-sm font-semibold ${step >= n ? "text-lb-ink" : "text-lb-dim"}`}>{label}</span>
            {i === 0 && <span className={`h-px w-10 sm:w-16 ${step >= 2 ? "bg-lb-accent" : "bg-lb-glass-line-2"}`} />}
          </li>
        ))}
      </ol>

      <GlassCard raised className="relative p-6 sm:p-8">
        {googleBusy && <AuthBusyOverlay label="Checking your Google account…" />}
        {step === 1 && (
          <>
            <h1 className="text-2xl font-bold">Register your gym</h1>
            <p className="mt-1 text-sm text-lb-ink2">
              Create your LimitBeyond owner account, then tell us about your gym.
            </p>

            {googleEnabled && (
              <div className="mt-6">
                <GoogleSignInButton onCredential={onGoogleCredential} text="continue_with" />
                <p className="mt-2 text-center text-xs text-lb-dim">
                  Fastest way: we verify your email with Google, then you just add your gym.
                </p>
                <div className="my-5 flex items-center gap-3 text-xs text-lb-dim">
                  <span className="h-px flex-1 bg-lb-glass-line-2" />
                  or sign up with email
                  <span className="h-px flex-1 bg-lb-glass-line-2" />
                </div>
              </div>
            )}

            <form onSubmit={submitStep1} className={`flex flex-col gap-4 ${googleEnabled ? "" : "mt-6"}`}>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="First name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                <TextField label="Last name" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <TextField label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              <TextField
                label="Phone number"
                required
                value={phoneE164}
                onChange={(e) => setPhoneE164(e.target.value)}
                hint="Used for password resets and account recovery."
              />
              <TextField
                label="Password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                hint="At least 8 characters."
              />

              {error && <p className="text-sm text-lb-alert">{error}</p>}

              <Button type="submit" loading={loading} fullWidth size="lg" className="mt-2">
                Continue <ArrowRight className="size-4" />
              </Button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-2xl font-bold">Tell us about your gym</h1>
            <p className="mt-1 text-sm text-lb-ink2">Add your first location — you can add more later.</p>
            {accountEmail && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-lb-field)] border border-lb-glass-line-2 bg-lb-glass px-4 py-2.5 text-sm">
                <span className="text-lb-ink2">
                  Signed in as <b className="text-lb-ink">{accountEmail}</b>
                </span>
                <button
                  type="button"
                  onClick={switchAccount}
                  className="cursor-pointer font-semibold text-lb-accent underline-offset-4 hover:underline"
                >
                  Use a different account
                </button>
              </div>
            )}

            <form onSubmit={submitStep2} className="mt-6 flex flex-col gap-4">
              <p className="text-xs font-extrabold tracking-[0.16em] text-lb-accent uppercase">Gym details</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Legal name"
                  required
                  placeholder="e.g. Neelkanth Fitness Pvt Ltd"
                  value={legalName}
                  onChange={(e) => onLegalNameChange(e.target.value)}
                />
                <TextField
                  label="Trading name"
                  placeholder="e.g. Neelkanth Gym"
                  value={tradingName}
                  onChange={(e) => setTradingName(e.target.value)}
                />
                <TextField
                  label="Gym URL"
                  required
                  placeholder="neelkanth-gym"
                  value={gymSlug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setGymSlug(slugify(e.target.value));
                  }}
                  hint={`limitbeyond.com/gyms/${gymSlug || "your-gym"}`}
                />
                <TextField
                  label="GSTIN"
                  placeholder="22AAAAA0000A1Z5"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  hint="Optional"
                />
              </div>

              <div className="my-1 h-px bg-lb-glass-line-2" />
              <p className="text-xs font-extrabold tracking-[0.16em] text-lb-accent uppercase">First location</p>

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Location name"
                  required
                  placeholder="e.g. Laxmi Nagar"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                />
                <TextField
                  label="Location phone"
                  required
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="98765 43210"
                  value={locationPhone}
                  onChange={(e) => setLocationPhone(e.target.value)}
                  hint="We'll use this to reach the branch."
                />
                <div className="sm:col-span-2">
                  <TextField
                    label="Address line 1"
                    required
                    placeholder="Building, street, landmark"
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                  />
                </div>
                <TextField
                  label="Address line 2"
                  placeholder="Area, locality"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  hint="Optional"
                />
                <TextField
                  label="Pincode"
                  required
                  inputMode="numeric"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  placeholder="110092"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                />
                <SearchableSelect
                  label="State"
                  required
                  placeholder="Select state"
                  options={stateOptions}
                  value={stateCode}
                  onChange={(v) => {
                    setStateCode(v);
                    setCity("");
                  }}
                />
                <SearchableSelect
                  label="City / district"
                  required
                  placeholder={stateCode ? "Select city" : "Choose a state first"}
                  options={cityOptions}
                  value={city}
                  onChange={setCity}
                  disabled={!stateCode}
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                onClick={captureLocation}
                loading={locating}
                className={coords ? "border-lb-good/50 text-lb-good" : ""}
              >
                {coords ? <Check className="size-4" /> : <LocateFixed className="size-4" />}
                {coords ? "Location captured" : "Capture current location"}
              </Button>

              {error && <p className="text-sm text-lb-alert">{error}</p>}

              <div className="mt-2 flex gap-3">
                {!viaGoogle && (
                  <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                    <ArrowLeft className="size-4" /> Back
                  </Button>
                )}
                <Button type="submit" loading={loading} fullWidth size="lg">
                  Register gym
                </Button>
              </div>
              <p className="text-center text-xs text-lb-dim">
                <span className="text-lb-alert">*</span> Required. Your details are reviewed by our team before your gym goes live.
              </p>
            </form>
          </>
        )}

        {step === 1 && (
          <p className="mt-6 text-center text-sm text-lb-ink2">
            Already have an account?{" "}
            <Link href="/admin/login" className="font-semibold text-lb-accent hover:underline">
              Sign in
            </Link>
          </p>
        )}
      </GlassCard>
    </div>
  );
}
