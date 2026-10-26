package com.limitbeyond.attendance.persistence;

import com.limitbeyond.attendance.domain.CheckIn;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface CheckInRepository extends JpaRepository<CheckIn, UUID> {

    Optional<CheckIn> findByUserIdAndIdempotencyKey(UUID userId, String idempotencyKey);

    List<CheckIn> findByUserIdOrderByOccurredAtDesc(UUID userId);

    /** Used by the geofence duplicate-window check (FR-ATT-05): has this
     *  user already checked in at this location within the last N minutes? */
    @Query("select count(c) > 0 from CheckIn c where c.userId = :userId and c.locationId = :locationId "
            + "and c.occurredAt >= :since")
    boolean existsRecentCheckIn(UUID userId, UUID locationId, Instant since);
}
