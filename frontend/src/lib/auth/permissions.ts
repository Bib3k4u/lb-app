import { GrantView, Role } from "@/lib/api/types";

/**
 * UI-only visibility helper — mirrors the backend's scope-then-role check
 * (AuthContext.isAllowed) so the console shows/hides the right actions. The
 * backend remains the sole source of truth; this never grants access itself.
 */
export function hasRole(grants: GrantView[], role: Role, locationId?: string): boolean {
  return grants.some((grant) => {
    if (grant.role !== role) return false;
    if (grant.gymWide) return true;
    if (!locationId) return true;
    return grant.locationIds.includes(locationId);
  });
}

export function isSuperAdmin(grants: GrantView[]): boolean {
  return hasRole(grants, "SUPER_ADMIN");
}

export function isGymOwner(grants: GrantView[]): boolean {
  return hasRole(grants, "GYM_OWNER");
}

export function isLocationAdmin(grants: GrantView[]): boolean {
  return hasRole(grants, "LOCATION_ADMIN");
}

export function isAdmin(grants: GrantView[]): boolean {
  return isSuperAdmin(grants) || isGymOwner(grants) || isLocationAdmin(grants);
}

/** Who may use the admin console: admin roles, or a gym registrant whose gym is
 *  still awaiting review. Members and trainers hold grants too but never qualify. */
export function canUseConsole(user: { grants?: GrantView[]; pendingGym?: unknown } | null | undefined): boolean {
  return Boolean(user) && (isAdmin(user?.grants ?? []) || Boolean(user?.pendingGym));
}

/** Signed in with roles, but none of them administrative (a member or trainer). */
export function isNonAdminWithRoles(user: { grants?: GrantView[]; pendingGym?: unknown } | null | undefined): boolean {
  return Boolean(user) && (user?.grants?.length ?? 0) > 0 && !canUseConsole(user);
}

export function primaryGymId(grants: GrantView[]): string | null {
  return grants.find((g) => g.gymId)?.gymId ?? null;
}

export function adminLocationIds(grants: GrantView[]): string[] {
  const ids = new Set<string>();
  for (const grant of grants) {
    if (grant.role === "GYM_OWNER" || grant.role === "LOCATION_ADMIN") {
      grant.locationIds.forEach((id) => ids.add(id));
    }
  }
  return [...ids];
}
