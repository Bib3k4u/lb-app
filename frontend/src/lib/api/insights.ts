"use client";

import { api, toQuery } from "./client";
import {
  DashboardResponse,
  MemberActivity,
  RecentCheckIn,
  TrainerActivity,
  TrainerDailyActivity,
} from "./types";

export interface RangeParams {
  locationId?: string;
  from?: string;
  to?: string;
}

export function fetchDashboard(params: RangeParams & { recentLimit?: number } = {}) {
  return api.get<DashboardResponse>(`admin/dashboard${toQuery(params)}`);
}

export function fetchMembersActivity(params: RangeParams & { search?: string; limit?: number } = {}) {
  return api.get<MemberActivity[]>(`admin/dashboard/members${toQuery(params)}`);
}

export function fetchRecentCheckIns(params: RangeParams & { limit?: number } = {}) {
  return api.get<RecentCheckIn[]>(`admin/dashboard/check-ins/recent${toQuery(params)}`);
}

export function fetchTrainerActivity(params: RangeParams = {}) {
  return api.get<TrainerActivity[]>(`admin/dashboard/trainers${toQuery(params)}`);
}

export function fetchTrainerDailyActivity(params: RangeParams = {}) {
  return api.get<TrainerDailyActivity[]>(`admin/dashboard/trainers/daily${toQuery(params)}`);
}
