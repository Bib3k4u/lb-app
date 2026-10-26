"use client";

import { api, toQuery } from "./client";
import { PublicGymListing } from "./types";

export interface PublicGymSearchParams {
  search?: string;
  state?: string;
  city?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  limit?: number;
}

/** Genuinely public — no session required, works whether or not the caller
 * is signed in. Uses the shared client, which only attaches an
 * Authorization header when there is a stored session. */
export function searchPublicGyms(params: PublicGymSearchParams = {}) {
  return api.get<PublicGymListing[]>(`public/gyms${toQuery(params)}`);
}
