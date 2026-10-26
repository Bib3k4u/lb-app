package com.limitbeyond.shared.rls;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * The authenticated caller's authority for one request.
 *
 * <p>Built by {@code JwtAuthenticationFilter} from the JWT's role grants and
 * consumed by two independent controls:
 *
 * <ol>
 *   <li>{@code auth.require(role, locationId)} in every tenant-scoped
 *       service method (NN-5) — the primary control, checked against
 *       {@link #roles()}.
 *   <li>{@link RlsContextAspect}, which pushes {@link #gymId()},
 *       {@link #locationIds()} etc. into the database session so RLS
 *       policies filter every query — the second line.
 * </ol>
 *
 * <p>The redundancy is deliberate. A single mistake in either breaches
 * neither.
 *
 * <p><strong>On the single active gym.</strong> An account may hold grants
 * at more than one gym (OPN-04 in the SRS, closed pragmatically here rather
 * than left open): the security filter resolves ONE gym as active per
 * request — via {@code X-Gym-Id} when the caller sends it and it names a
 * gym they hold a grant at, falling back to the lowest gym id they hold a
 * grant at otherwise — and this context reflects only that gym. Everything
 * below is scoped to it; a grant at a different gym is invisible to this
 * request entirely, which is exactly what {@code NFR-SEC-01}'s isolation
 * requires.
 *
 * @param userId      the authenticated account; null only when unauthenticated
 * @param gymId       the active gym for this request; null for an
 *                    unauthenticated caller, a Super Admin acting across
 *                    gyms, or an authenticated account that holds no grant
 *                    anywhere yet (e.g. mid-registration)
 * @param roles       role names held at {@code gymId} — the union across
 *                    every grant this account holds there, e.g. a single
 *                    account may legitimately hold both {@code TRAINER} and
 *                    {@code LOCATION_ADMIN} (FR-AUTH-26)
 * @param locationIds the union of locations named across every grant at
 *                    {@code gymId}; empty when {@code gymWide}
 * @param gymWide     true if ANY grant at {@code gymId} carries gym-wide
 *                    scope (Gym Owner) — FR-AUTH-28's "union, not maximum"
 *                    rule means one gym-wide grant is enough even if the same
 *                    account also holds a narrower, location-scoped grant
 * @param superAdmin  platform operator; bypasses gym isolation entirely, but
 *                    never exceeds a Gym Owner's DATA tier — that narrower
 *                    restriction is enforced in the service layer, not here
 *                    (LB-ENG-1.0 §13)
 */
public record AuthContext(
        UUID userId,
        UUID gymId,
        Set<String> roles,
        Set<UUID> locationIds,
        boolean gymWide,
        boolean superAdmin) {

    public AuthContext {
        roles = roles == null ? Set.of() : Set.copyOf(roles);
        locationIds = locationIds == null ? Set.of() : Set.copyOf(locationIds);
    }

    /** Comma-separated form for {@code set_config('app.location_ids', ...)}. */
    public String locationIdsCsv() {
        return String.join(",", locationIds.stream().map(UUID::toString).toList());
    }

    /** Does this account act at the given location right now, in any role? */
    public boolean appliesAt(UUID locationId) {
        return superAdmin || gymWide || locationIds.contains(locationId);
    }

    public boolean hasRole(String role) {
        return roles.contains(role);
    }

    /**
     * The scope check FIRST, the role check second — reversing these two is
     * exactly the bug FR-AUTH-28 exists to prevent: it would grant authority
     * everywhere a role is held anywhere, rather than only where it applies.
     */
    public boolean isAllowed(UUID locationId, String... anyOfRoles) {
        if (!appliesAt(locationId)) {
            return false;
        }
        if (superAdmin) {
            return true;
        }
        for (String role : anyOfRoles) {
            if (roles.contains(role)) {
                return true;
            }
        }
        return false;
    }

    public boolean isAdmin() {
        return superAdmin || roles.contains("GYM_OWNER") || roles.contains("LOCATION_ADMIN");
    }

    public boolean isAuthenticated() {
        return userId != null;
    }

    /** An unauthenticated context. Resolves every RLS setting to null, so
     *  policies match nothing and queries return zero rows — fail closed. */
    public static AuthContext anonymous() {
        return new AuthContext(null, null, Set.of(), Set.of(), false, false);
    }

    public static AuthContext superAdmin(UUID userId) {
        return new AuthContext(userId, null, Set.of("SUPER_ADMIN"), Set.of(), false, true);
    }

    /** Authenticated, but holding no grant at any gym yet (e.g. mid-registration). */
    public static AuthContext noGymContext(UUID userId) {
        return new AuthContext(userId, null, Set.of(), Set.of(), false, false);
    }

    public static AuthContext of(UUID userId, UUID gymId, Set<String> roles,
            List<UUID> locationIds, boolean gymWide) {
        return new AuthContext(userId, gymId, roles, Set.copyOf(locationIds), gymWide, false);
    }
}
