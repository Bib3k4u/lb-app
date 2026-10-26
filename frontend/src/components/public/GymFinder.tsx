"use client";

import { useEffect, useMemo, useState } from "react";
import { getAllStates, getDistricts } from "india-state-district";
import { ArrowUpRight, Dumbbell, LocateFixed, MapPin, Search, X } from "lucide-react";
import { searchPublicGyms } from "@/lib/api/discovery";
import { PublicGymListing } from "@/lib/api/types";
import { GlassCard } from "@/components/ui/GlassCard";
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

/** Directions link: exact pin when the location has coordinates, otherwise a
 *  Maps search by name and city (a gym registered without a captured location
 *  is stored at 0,0, which would point into the ocean). */
function directionsUrl(gym: { latitude: number; longitude: number; gymName: string; locationName: string; city: string }) {
  if (gym.latitude === 0 && gym.longitude === 0) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${gym.gymName} ${gym.locationName} ${gym.city}`)}`;
  }
  return `https://www.google.com/maps?q=${gym.latitude},${gym.longitude}`;
}

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
        <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-lb-dim">Find a gym</p>
        <h2 className="max-w-xl font-heading text-4xl font-bold tracking-wide uppercase sm:text-5xl">
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
              <span className="text-[13px] font-medium text-current/70">Near me</span>
              {coords ? (
                <Button variant="ghost" size="md" onClick={() => setCoords(null)}>
                  <X className="size-4" /> Clear location
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="md"
                 
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
              <div key={i} className="lb-skeleton h-36 rounded-[var(--radius-lb-card)]" />
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
                <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-lb-glass-line bg-lb-glass-2 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-lb-accent/60 hover:shadow-[0_24px_48px_-24px_rgba(246,220,60,0.45)]">
                  {/* soft brand glow in the corner */}
                  <div
                    className="pointer-events-none absolute -top-16 -right-16 size-44 rounded-full opacity-60 blur-2xl transition-opacity group-hover:opacity-100"
                    style={{ background: "radial-gradient(circle, var(--color-lb-glow), transparent 70%)" }}
                    aria-hidden
                  />

                  <div className="relative flex items-start justify-between gap-3">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-lb-accent text-lb-on-accent shadow-lb-accent">
                      <Dumbbell className="size-6" />
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-lb-glass-line-2 bg-lb-glass px-3 py-1 text-[11px] font-bold tracking-wide text-lb-ink2">
                      <span className="size-1.5 rounded-full bg-lb-good" aria-hidden />
                      Live
                    </span>
                  </div>

                  <div className="relative mt-5 min-w-0">
                    <h3 className="font-heading text-2xl leading-tight font-bold tracking-wide text-lb-ink uppercase">
                      {gym.gymName}
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-lb-ink2">{gym.locationName}</p>
                  </div>

                  <div className="relative mt-4 flex flex-wrap items-center gap-2 text-sm text-lb-ink2">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-4 shrink-0 text-lb-accent" />
                      {gym.city}, {gym.state}
                    </span>
                    {gym.distanceKm !== undefined && (
                      <span className="lb-num rounded-full bg-lb-accent/15 px-2.5 py-0.5 text-xs font-bold text-lb-ink">
                        {gym.distanceKm < 1 ? `${Math.round(gym.distanceKm * 1000)} m` : `${gym.distanceKm.toFixed(1)} km`} away
                      </span>
                    )}
                  </div>

                  <a
                    href={directionsUrl(gym)}
                    target="_blank"
                    rel="noreferrer"
                    className="relative mt-6 inline-flex items-center justify-center gap-2 rounded-full border border-lb-glass-line-2 bg-lb-glass px-5 py-3 text-sm font-bold text-lb-ink transition-colors group-hover:border-lb-accent group-hover:bg-lb-accent group-hover:text-lb-on-accent"
                  >
                    Get directions <ArrowUpRight className="size-4" />
                  </a>
                </article>
              </StaggerItem>
            ))}
          </StaggerList>
        )}
      </div>
    </section>
  );
}
