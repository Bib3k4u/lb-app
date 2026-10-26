/**
 * India state/district lists for the location form's City and State
 * dropdowns. "City" is backed by district-level data (the package has no
 * finer city list) — the closest fixed list available without pulling in a
 * full world geo dataset.
 */
import { getAllStates, getDistricts } from 'india-state-district';

export function indiaStateNames(): string[] {
  return getAllStates()
    .map((s) => s.name)
    .sort((a, b) => a.localeCompare(b));
}

export function districtsForStateName(stateName: string): string[] {
  const state = getAllStates().find((s) => s.name === stateName);
  if (!state) return [];
  return [...getDistricts(state.code)].sort((a, b) => a.localeCompare(b));
}
