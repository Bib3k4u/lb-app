/**
 * Global auth state. Deliberately tiny (LB-ENG-1.0 §8.2): server state belongs
 * to TanStack Query, local UI state to useState. Only the session and the
 * account's role grants live here, because navigation depends on them.
 */
import { create } from 'zustand';
import type { AuthContext, RoleGrant } from './permissions';
import { hasAnyAdminRole, rolesHeld } from './permissions';
import { signOut as clearTokens } from './session';
import { clearLocalDatabase } from '../db';
import { queryClient } from '../queryClient';

export type AccountState =
  | 'PENDING_VERIFICATION'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'DEACTIVATED';

export interface CurrentUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phoneE164: string | null;
  state: AccountState;
  dateOfBirth: string | null;
  gender: string | null;
  heightCm: string | null;
  experienceLevel: string | null;
  primaryGoal: string | null;
  /** Server-computed — see AuthDtos.MeResponse's Javadoc. The single source
   *  of truth for "does onboarding still need to run"; never re-derived here. */
  profileComplete: boolean;
  grants: RoleGrant[];
  /** Non-null only if this person registered a gym that isn't LIVE yet —
   *  tells "hasn't chosen a path" and "started a gym, awaiting review" apart,
   *  both otherwise a zero-grant account. See backend AuthDtos.PendingGym. */
  pendingGym: { id: string; slug: string; legalName: string; state: string } | null;
  /** The location currently being acted at — admins may administer several. */
  activeGymId: string | null;
  activeLocationId: string | null;
}

interface AuthState {
  user: CurrentUser | null;
  hydrated: boolean;
  setUser: (user: CurrentUser | null) => void;
  setHydrated: (v: boolean) => void;
  setActiveLocation: (gymId: string, locationId: string) => void;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  hydrated: false,
  setUser: (user) => set({ user }),
  setHydrated: (hydrated) => set({ hydrated }),
  setActiveLocation: (activeGymId, activeLocationId) =>
    set((s) => (s.user ? { user: { ...s.user, activeGymId, activeLocationId } } : s)),
  signOut: async () => {
    // user goes to null FIRST: index.tsx's routing reacts to this
    // immediately, rather than waiting on the token/cache cleanup below,
    // which has no reason to block the UI from moving on.
    set({ user: null });
    // Server state cached under the outgoing account must never be visible
    // to whoever signs in next on this device — a stale gym directory or
    // /me response from the last session is exactly the kind of bug that's
    // invisible until two different people share a phone.
    queryClient.clear();
    // A queued check-in belongs to the account that made it. Leaving the outbox
    // behind would submit one person's arrival under the next person's session.
    clearLocalDatabase();
    await clearTokens();
  },
}));

export function authContext(user: CurrentUser): AuthContext {
  return { userId: user.id, grants: user.grants };
}

/** The backend's MeResponse shape (snake-free, but `gymWide` not `isGymWide`
 *  per grant, and no activeGymId/activeLocationId — those are client-only
 *  navigation state). One mapping function so every call site — otp/verify,
 *  login, refresh, PATCH /me — builds a CurrentUser the same way. */
export interface MeResponseDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phoneE164: string | null;
  state: AccountState;
  dateOfBirth: string | null;
  gender: string | null;
  heightCm: string | null;
  experienceLevel: string | null;
  primaryGoal: string | null;
  profileComplete: boolean;
  grants: { role: RoleGrant['role']; gymId: string | null; locationIds: string[]; gymWide: boolean }[];
  pendingGym: { id: string; slug: string; legalName: string; state: string } | null;
}

/** Shared response shape for every auth operation that rotates the session. */
export interface TokenResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: MeResponseDto;
}

export function mapMeResponseToUser(dto: MeResponseDto, previous?: CurrentUser | null): CurrentUser {
  const firstGymGrant = dto.grants.find((grant) => grant.gymId !== null);
  const firstScopedGrant = dto.grants.find(
    (grant) => grant.gymId !== null && grant.locationIds.length > 0,
  );
  // Gym Owners are gym-wide, so their grant intentionally contains no
  // location ids. The gym itself must still become active; a live location
  // is resolved by screens that need one (check-in, feedback, etc.).
  const defaultGymId = firstGymGrant?.gymId ?? null;
  const defaultLocationId = firstScopedGrant?.locationIds[0] ?? null;

  return {
    id: dto.id,
    firstName: dto.firstName,
    lastName: dto.lastName,
    email: dto.email,
    phoneE164: dto.phoneE164,
    state: dto.state,
    dateOfBirth: dto.dateOfBirth,
    gender: dto.gender,
    heightCm: dto.heightCm,
    experienceLevel: dto.experienceLevel,
    primaryGoal: dto.primaryGoal,
    profileComplete: dto.profileComplete,
    grants: dto.grants.map((g) => ({
      role: g.role,
      gymId: g.gymId,
      locationIds: g.locationIds,
      isGymWide: g.gymWide,
    })),
    pendingGym: dto.pendingGym,
    activeGymId: previous?.activeGymId ?? defaultGymId,
    activeLocationId: previous?.activeLocationId ?? defaultLocationId,
  };
}

/**
 * Which navigation groups to mount.
 *
 * `training` is unconditional — every account owns a personal fitness profile
 * (FR-PFP-01), so the training dashboard is not a role's privilege. This
 * function is the routing layer's expression of the dual-facet model, and the
 * `training: true` below should never become conditional.
 */
export function visibleSections(user: CurrentUser) {
  const ctx = authContext(user);
  const roles = rolesHeld(ctx);
  return {
    training: true,
    member: roles.has('MEMBER'),
    trainer: roles.has('TRAINER'),
    admin: hasAnyAdminRole(ctx),
    superadmin: roles.has('SUPER_ADMIN'),
  };
}
