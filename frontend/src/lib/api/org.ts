"use client";

import { api } from "./client";
import { LocationInput, LocationQrToken, LocationSummary } from "./types";

export function fetchLocations() {
  return api.get<LocationSummary[]>("locations");
}

export function fetchLiveLocations() {
  return api.get<LocationSummary[]>("locations/live");
}

export function fetchLocationReviewQueue() {
  return api.get<LocationSummary[]>("locations/review-queue");
}

export function createLocation(input: LocationInput) {
  return api.post<{ id: string }>("locations", input);
}

export function updateLocation(locationId: string, input: LocationInput) {
  return api.put<void>(`locations/${locationId}`, input);
}

export function decideLocationVerification(locationId: string, input: { approved: boolean; reason?: string }) {
  return api.post<void>(`locations/${locationId}/verification`, input);
}

export function deleteLocation(locationId: string) {
  return api.del<void>(`locations/${locationId}`);
}

export function fetchLocationQrToken(locationId: string) {
  return api.get<LocationQrToken>(`locations/${locationId}/qr-token`);
}
