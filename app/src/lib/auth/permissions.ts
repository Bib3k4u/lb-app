/**
 * Authority evaluation — the client-side mirror of the backend permission model.
 *
 * LB-ENG-1.0 §13 / FR-AUTH-28: effective authority is the UNION of an account's
 * role grants EVALUATED PER LOCATION — never the maximum applied everywhere.
 * A trainer who is Location Admin at one site holds no admin authority at another.
 *
 * This module decides what the UI *shows*. It is never the enforcement — the
 * server re-evaluates every request and RLS filters every query (NN-5).
 * Hiding a button is a courtesy; refusing the request is the control.
 */

export type Role =
  | 'SUPER_ADMIN'
  | 'GYM_OWNER'
  | 'LOCATION_ADMIN'
  | 'TRAINER'
  | 'MEMBER';

export type Permission =
  // platform
  | 'VERIFY_GYM'
  | 'RECORD_GYM_SUBSCRIPTION'
  | 'VIEW_CROSS_GYM_REPORTS'
  // gym-wide (Gym Owner only — FR-ORG-12)
  | 'MANAGE_GYM_PROFILE'
  | 'MANAGE_PLAN_CATALOGUE'
  | 'MANAGE_LOCATIONS'
  // location-scoped administration
  | 'APPOINT_ADMIN'
  | 'VERIFY_STAFF_AND_MEMBERS'
  | 'MANAGE_MEMBERS'
  | 'RECORD_PAYMENT'
  | 'MANAGE_TIMETABLE'
  | 'MARK_ATTENDANCE_FOR_OTHERS'
  // coaching
  | 'AUTHOR_TRAINING_PLAN'
  | 'CONDUCT_PT_SESSION'
  | 'ISSUE_COACHING_FEEDBACK'
  | 'VIEW_HEALTH_SCREENING';

/** A single grant of authority, scoped to one gym and (unless gym-wide) named locations.
 *  gymId is null for exactly one role: SUPER_ADMIN's authority is platform-wide,
 *  tied to no single gym (mirrors AuthContext.superAdmin() server-side). */
export interface RoleGrant {
  role: Role;
  gymId: string | null;
  /** Empty when isGymWide — see FR-AUTH-18. */
  locationIds: string[];
  isGymWide: boolean;
}

export interface AuthContext {
  userId: string;
  grants: RoleGrant[];
}

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    'VERIFY_GYM',
    'RECORD_GYM_SUBSCRIPTION',
    'VIEW_CROSS_GYM_REPORTS',
    'MANAGE_GYM_PROFILE',
    'MANAGE_PLAN_CATALOGUE',
    'MANAGE_LOCATIONS',
    'APPOINT_ADMIN',
    'VERIFY_STAFF_AND_MEMBERS',
    'MANAGE_MEMBERS',
    'RECORD_PAYMENT',
    'MANAGE_TIMETABLE',
    'MARK_ATTENDANCE_FOR_OTHERS',
    'AUTHOR_TRAINING_PLAN',
    'CONDUCT_PT_SESSION',
    'ISSUE_COACHING_FEEDBACK',
    'VIEW_HEALTH_SCREENING',
  ],
  GYM_OWNER: [
    'MANAGE_GYM_PROFILE',
    'MANAGE_PLAN_CATALOGUE',
    'MANAGE_LOCATIONS',
    'APPOINT_ADMIN',
    'VERIFY_STAFF_AND_MEMBERS',
    'MANAGE_MEMBERS',
    'RECORD_PAYMENT',
    'MANAGE_TIMETABLE',
    'MARK_ATTENDANCE_FOR_OTHERS',
    'AUTHOR_TRAINING_PLAN',
    'CONDUCT_PT_SESSION',
    'ISSUE_COACHING_FEEDBACK',
    'VIEW_HEALTH_SCREENING',
  ],
  LOCATION_ADMIN: [
    'APPOINT_ADMIN',
    'VERIFY_STAFF_AND_MEMBERS',
    'MANAGE_MEMBERS',
    'RECORD_PAYMENT',
    'MANAGE_TIMETABLE',
    'MARK_ATTENDANCE_FOR_OTHERS',
    'AUTHOR_TRAINING_PLAN',
    'CONDUCT_PT_SESSION',
    'ISSUE_COACHING_FEEDBACK',
    'VIEW_HEALTH_SCREENING',
  ],
  TRAINER: [
    'MARK_ATTENDANCE_FOR_OTHERS',
    'AUTHOR_TRAINING_PLAN',
    'CONDUCT_PT_SESSION',
    'ISSUE_COACHING_FEEDBACK',
    'VIEW_HEALTH_SCREENING',
  ],
  // A member holds no authority over anyone else. Their own training data is
  // not a permission — every account owns a fitness profile (FR-PFP-01).
  MEMBER: [],
};

/** Does this grant apply at the given location? SUPER_ADMIN checked first,
 *  deliberately before the gym match: their grant's gymId is null (platform-
 *  wide, not tied to any one gym), so comparing it against a real gymId
 *  first would always fail and silently deny a Super Admin everywhere. */
function appliesAt(grant: RoleGrant, gymId: string, locationId: string): boolean {
  if (grant.role === 'SUPER_ADMIN') return true;
  if (grant.gymId !== gymId) return false;
  if (grant.isGymWide) return true;
  return grant.locationIds.includes(locationId);
}

/**
 * The scope check comes FIRST and is never skipped. Reversing these two lines —
 * checking the permission before the location — is precisely the bug FR-AUTH-28
 * exists to prevent: it would grant authority everywhere it is held anywhere.
 */
export function can(
  ctx: AuthContext,
  permission: Permission,
  at: { gymId: string; locationId: string },
): boolean {
  return ctx.grants
    .filter((g) => appliesAt(g, at.gymId, at.locationId))
    .some((g) => ROLE_PERMISSIONS[g.role].includes(permission));
}

/** Roles held anywhere — drives which navigation groups are mounted. */
export function rolesHeld(ctx: AuthContext): Set<Role> {
  return new Set(ctx.grants.map((g) => g.role));
}

export function hasAnyAdminRole(ctx: AuthContext): boolean {
  const roles = rolesHeld(ctx);
  return (
    roles.has('SUPER_ADMIN') || roles.has('GYM_OWNER') || roles.has('LOCATION_ADMIN')
  );
}

/** Locations this account may act at, for a given permission. */
export function locationsFor(ctx: AuthContext, permission: Permission): string[] {
  const out = new Set<string>();
  for (const g of ctx.grants) {
    if (!ROLE_PERMISSIONS[g.role].includes(permission)) continue;
    g.locationIds.forEach((id) => out.add(id));
  }
  return [...out];
}
