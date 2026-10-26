"use client";

import { useEffect, useMemo, useState } from "react";
import { getAllStates, getDistricts } from "india-state-district";
import { Dumbbell, LocateFixed, MapPin, Search, X } from "lucide-react";
import { searchPublicGyms } from "@/lib/api/discovery";
import { PublicGymListing } from "@/lib/api/types";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { TextField } from "@/components/ui/TextField";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { StaggerItem, StaggerList } from "@/components/motion/StaggerList";
import { FadeIn } from "@/components/motion/FadeIn";

const states = getAllStates();
const stateOptions = states.map((s) => ({ value: s.code, label: s.name }));
const radiusOptions = [
  { value: "5", label: "5 km" },
  { value: "10", label: "10 km" },
  { value: "25", label: "25 km" },
  { value: "50", label: "50 km" },
];

export function GymFinder() {
  const [search, setSearch] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [city, setCity] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState("25");
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const [results, setResults] = useState<PublicGymListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cityOptions = useMemo(
    () => (stateCode ? getDistricts(stateCode).map((d) => ({ value: d, label: d })) : []),
    [stateCode],
  );

  const stateName = states.find((s) => s.code === stateCode)?.name;

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(() => {
      setLoading(true);
      setError(null);
      searchPublicGyms({
        search: search.trim() || undefined,
        state: stateName,
        city: city || undefined,
        lat: coords?.lat,
        lng: coords?.lng,
        radiusKm: coords ? Number(radiusKm) : undefined,
        limit: 24,
      })
        .then((data) => {
          if (!cancelled) setResults(data);
        })
        .catch(() => {
          if (!cancelled) setError("Couldn't load gyms right now.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [search, stateName, city, coords, radiusKm]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocateError("Geolocation isn't available in this browser.");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocateError("Couldn't read your location — check your browser's permission for this site.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-5 py-20">
      <FadeIn>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-lb-navy/50">Find a gym</p>
        <h2 className="max-w-xl text-3xl font-extrabold tracking-tight sm:text-4xl">
          Gyms already running on LimitBeyond.
        </h2>
      </FadeIn>

      <FadeIn delay={0.05}>
        <GlassCard className="mt-8 border-lb-glass-line bg-lb-glass-2">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TextField
              label="Gym name"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftAdornment={<Search className="size-4" />}
            />
            <SearchableSelect
              label="State"
              placeholder="Any state"
              options={stateOptions}
              value={stateCode}
              onChange={(v) => {
                setStateCode(v);
                setCity("");
              }}
            />
            <SearchableSelect
              label="City"
              placeholder="Any city"
              options={cityOptions}
              value={city}
              onChange={setCity}
              disabled={!stateCode}
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-lb-navy/70">Near me</span>
              {coords ? (
                <Button variant="ghost" size="md" className="border-lb-navy/15 bg-lb-navy/5 text-lb-navy" onClick={() => setCoords(null)}>
                  <X className="size-4" /> Clear location
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="md"
                  className="border-lb-navy/15 bg-lb-navy/5 text-lb-navy"
                  loading={locating}
                  onClick={useMyLocation}
                >
                  <LocateFixed className="size-4" /> Use my location
                </Button>
              )}
            </div>
          </div>

          {locateError && <p className="mt-3 text-xs text-lb-alert">{locateError}</p>}

          {coords && (
            <div className="mt-4">
              <ChipGroup label="Search radius" options={radiusOptions} value={radiusKm} onChange={setRadiusKm} />
            </div>
          )}
        </GlassCard>
      </FadeIn>

      <div className="mt-10">
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="lb-skeleton-light h-36 rounded-[var(--radius-lb-card)]" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} />
        ) : results.length === 0 ? (
          <EmptyState
            icon={Dumbbell}
            title="No gyms match yet"
            description="Try a wider radius, or clear a filter — new gyms join LimitBeyond every week."
          />
        ) : (
          <StaggerList className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((gym) => (
              <StaggerItem key={gym.locationId}>
                <div className="group relative h-full overflow-hidden rounded-[var(--radius-lb-card)] border border-lb-glass-line bg-lb-glass-2 shadow-[0_1px_0_rgba(23,42,53,0.04)] transition-all duration-300 hover:-translate-y-1.5 hover:border-lb-navy/15 hover:shadow-[0_24px_48px_-20px_rgba(23,42,53,0.22)]">
                  {/* Gradient banner with a watermark icon */}
                  <div className="relative h-20 overflow-hidden bg-gradient-to-br from-[#172a35] to-[#0f2029]">
                    <div
                      className="absolute inset-0 opacity-70"
                      style={{
                        background:
                          "radial-gradient(60% 90% at 15% 0%, rgba(247,208,70,.35) 0%, transparent 60%), radial-gradient(50% 80% at 100% 100%, rgba(247,208,70,.18) 0%, transparent 60%)",
                      }}
                    />
                    <Dumbbell className="absolute -right-3 -top-3 size-24 rotate-12 text-white/10" strokeWidth={1.25} />
                    {gym.distanceKm !== undefined && (
                      <span className="lb-num absolute right-3 top-3 rounded-[var(--radius-lb-pill)] bg-black/30 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                        {gym.distanceKm < 1 ? `${Math.round(gym.distanceKm * 1000)} m` : `${gym.distanceKm.toFixed(1)} km`} away
                      </span>
                    )}
                  </div>

                  {/* Overlapping icon avatar */}
                  <div className="relative -mt-7 px-5">
                    <span className="flex size-14 items-center justify-center rounded-2xl border-4 border-lb-ground bg-lb-accent text-lb-on-accent shadow-[0_8px_18px_-6px_rgba(247,208,70,0.6)]">
                      <Dumbbell className="size-6" />
                    </span>
                  </div>

                  <div className="px-5 pb-5 pt-3">
                    <h3 className="truncate text-lg font-extrabold text-lb-navy">{gym.gymName}</h3>
                    <p className="mt-1 truncate text-sm font-medium text-lb-navy/55">{gym.locationName}</p>

                    <p className="mt-3 flex items-center gap-1.5 text-sm text-lb-navy/60">
                      <MapPin className="size-3.5 shrink-0 text-lb-navy/40" />
                      {gym.city}, {gym.state}
                    </p>

                    <div className="mt-4 flex items-center gap-2">
                      <Badge tone="good">Live on LimitBeyond</Badge>
                    </div>

                    <a
                      href={`https://www.google.com/maps?q=${gym.latitude},${gym.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 flex items-center justify-center gap-2 rounded-[var(--radius-lb-pill)] border border-lb-navy/15 bg-lb-navy/5 py-2.5 text-sm font-semibold text-lb-navy transition-colors hover:bg-lb-navy hover:text-white"
                    >
                      <MapPin className="size-4" /> Get directions
                    </a>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerList>
        )}
      </div>
    </section>
  );
}
