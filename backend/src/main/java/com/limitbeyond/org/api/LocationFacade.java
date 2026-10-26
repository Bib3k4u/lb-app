package com.limitbeyond.org.api;

import java.util.List;
import java.util.UUID;

/** What other modules may know about locations, through this facade alone. */
public interface LocationFacade {

    boolean existsInGym(UUID locationId, UUID gymId);

    /**
     * Metres between a location and a point, via Postgres's generated
     * {@code geography(Point,4326)} column (LB-DATA-1.0 §3) — ST_Distance on
     * a geography type accounts for earth's curvature, which is what makes
     * this correct rather than merely close at the distances a geofence
     * actually cares about. Used by {@code attendance} for FR-ATT-02's
     * geofenced check-in; kept behind this facade so attendance never reaches
     * into org's persistence layer directly.
     */
    double distanceMeters(UUID locationId, double latitude, double longitude);

    int checkinRadiusMeters(UUID locationId);

    /**
     * Bootstraps a gym's first location as part of gym registration itself
     * (FR-AUTH-04: "supplying the gym profile, AT LEAST ONE location, and
     * business contact details" — one submission, not a separate
     * authenticated call). This is the one place location creation happens
     * without the caller already holding Gym Owner authority — because at
     * registration time no such grant exists yet (FR-AUTH-16: it is only
     * created on activation). Every LATER location goes through the normal
     * authenticated {@code POST /locations}, which this facade does not
     * expose — that path requires real Gym Owner scope.
     */
    UUID createInitialLocation(NewLocation location);

    /** Approves or rejects a branch awaiting review. The caller must already be
     *  running as a Super Admin ({@code AuthContextHolder}); a rejection needs a reason. */
    void reviewLocation(UUID locationId, boolean approved, String reason);

    /**
     * Every location at a gym, for a prospective member/trainer choosing
     * where to join — not a gym-scoped read, so it needs the same RLS
     * bypass as {@link #existsInGym} for the same reason: the caller has no
     * gym context yet at this point in onboarding. See RlsContext#withSystemBypass.
     */
    java.util.List<LocationSummary> listForGym(UUID gymId);

    /** Full business-location details used when the platform operator reviews
     * a gym registration. Kept separate from {@link #listForGym} so the
     * join-gym directory continues to expose only public summary fields. */
    java.util.List<LocationDetail> listDetailsForGym(UUID gymId);

    /**
     * The public web directory's search (LB-DATA-1.0 §13.3) — unlike
     * {@link #listForGym}, this is scoped to {@code is_publicly_listed}
     * rows only, since it's reachable with no authentication at all. All
     * filters are optional; {@code radiusMeters} is only applied when both
     * {@code lat} and {@code lng} are also given.
     */
    List<PublicGymListing> searchPublicGyms(String search, String state, String city,
            Double lat, Double lng, Double radiusMeters, int limit);

    record PublicGymListing(
            UUID gymId, String gymSlug, String gymName, UUID locationId, String locationName,
            String city, String state, double latitude, double longitude, Double distanceMeters) {
    }

    record LocationSummary(UUID id, String slug, String name, String city) {
    }

    record LocationDetail(
            UUID id, String slug, String name, String addressLine1, String addressLine2,
            String city, String state, String pincode, String phoneE164, String approvalState) {
    }

    record NewLocation(
            UUID gymId, String slug, String name, String addressLine1, String addressLine2,
            String city, String state, String pincode, double latitude, double longitude,
            String phoneE164) {
    }
}
