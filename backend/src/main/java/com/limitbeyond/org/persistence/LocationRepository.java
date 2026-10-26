package com.limitbeyond.org.persistence;

import com.limitbeyond.org.domain.Location;
import com.limitbeyond.org.domain.Location.LocationState;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LocationRepository extends JpaRepository<Location, UUID> {
    List<Location> findByGymId(UUID gymId);

    List<Location> findByApprovalStateAndClosedAtIsNullOrderByCreatedAtAsc(LocationState state);

    boolean existsByIdAndGymIdAndApprovalStateAndClosedAtIsNull(UUID id, UUID gymId, LocationState state);

    /** ST_Distance on a geography column returns metres directly, correctly
     *  accounting for earth's curvature — see LocationFacade#distanceMeters. */
    @Query(value = "SELECT ST_Distance(geo, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography) "
            + "FROM locations WHERE id = :locationId AND approval_state = 'APPROVED' AND closed_at IS NULL", nativeQuery = true)
    Double distanceMetersNative(@Param("locationId") UUID locationId, @Param("lat") double lat, @Param("lng") double lng);

    /**
     * The public gym directory's search: name/state/city filters and an
     * optional "near me" radius, joined straight through to the parent gym
     * since a public listing is fundamentally "which of my locations can a
     * stranger discover" (LB-DATA-1.0 §13.3). {@code is_publicly_listed} on
     * BOTH tables is the actual safety boundary here, not RLS — see
     * LocationFacadeImpl#searchPublicGyms.
     */
    @Query(value = """
            SELECT g.id AS gym_id, g.slug::text AS gym_slug,
                   COALESCE(NULLIF(g.trading_name, ''), g.legal_name) AS gym_name,
                   l.id AS location_id, l.name AS location_name, l.city AS city, l.state AS state,
                   l.latitude AS latitude, l.longitude AS longitude,
                   CASE WHEN :lat IS NOT NULL AND :lng IS NOT NULL
                        THEN ST_Distance(l.geo, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography)
                        ELSE NULL END AS distance_m
            FROM locations l
            JOIN gyms g ON g.id = l.gym_id
            WHERE g.is_publicly_listed = true AND l.is_publicly_listed = true
              AND (:search IS NULL OR g.legal_name ILIKE '%' || :search || '%' OR g.trading_name ILIKE '%' || :search || '%')
              AND (:state IS NULL OR l.state ILIKE :state)
              AND (:city IS NULL OR l.city ILIKE :city)
              AND (:lat IS NULL OR :lng IS NULL OR :radiusM IS NULL
                   OR ST_DWithin(l.geo, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radiusM))
            ORDER BY CASE WHEN :lat IS NOT NULL AND :lng IS NOT NULL
                          THEN ST_Distance(l.geo, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography) END ASC NULLS LAST,
                     g.legal_name ASC
            LIMIT :limit
            """, nativeQuery = true)
    List<PublicGymRow> searchPublic(@Param("search") String search, @Param("state") String state,
            @Param("city") String city, @Param("lat") Double lat, @Param("lng") Double lng,
            @Param("radiusM") Double radiusM, @Param("limit") int limit);

    /** Interface projection matching {@code searchPublic}'s column aliases. */
    interface PublicGymRow {
        UUID getGymId();

        String getGymSlug();

        String getGymName();

        UUID getLocationId();

        String getLocationName();

        String getCity();

        String getState();

        double getLatitude();

        double getLongitude();

        Double getDistanceM();
    }
}
