package com.limitbeyond.attendance.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Append-only (DM-04). Its correctness rests entirely on
 * {@code uq_check_ins_idempotency}: the client reuses one key across every
 * retry (ENG-8.1), so a duplicate offline-replayed submission collides here
 * and the service returns the original row instead of inserting a second one.
 */
@Entity
@Table(name = "check_ins")
public class CheckIn {

    @Id
    private UUID id;

    @Column(name = "gym_id", nullable = false)
    private UUID gymId;

    @Column(name = "location_id", nullable = false)
    private UUID locationId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "checkin_method")
    private CheckInMethod method;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "checkin_purpose")
    private CheckInPurpose purpose;

    @Column(name = "recorded_by_user_id")
    private UUID recordedByUserId;

    @Column(name = "is_deferred")
    private boolean deferred;

    @Column(name = "distance_m")
    private Double distanceM;

    @Column(name = "is_flagged")
    private boolean flagged;

    @Column(name = "idempotency_key", nullable = false)
    private String idempotencyKey;

    @Column(name = "created_at")
    private Instant createdAt;

    protected CheckIn() {
    }

    public CheckIn(UUID gymId, UUID locationId, UUID userId, Instant occurredAt, CheckInMethod method,
            CheckInPurpose purpose, UUID recordedByUserId, boolean deferred, Double distanceM,
            boolean flagged, String idempotencyKey) {
        this.id = UUID.randomUUID();
        this.gymId = gymId;
        this.locationId = locationId;
        this.userId = userId;
        this.occurredAt = occurredAt;
        this.method = method;
        this.purpose = purpose;
        this.recordedByUserId = recordedByUserId;
        this.deferred = deferred;
        this.distanceM = distanceM;
        this.flagged = flagged;
        this.idempotencyKey = idempotencyKey;
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public UUID getGymId() {
        return gymId;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }

    public boolean isDeferred() {
        return deferred;
    }

    public UUID getLocationId() {
        return locationId;
    }

    public CheckInMethod getMethod() {
        return method;
    }

    public CheckInPurpose getPurpose() {
        return purpose;
    }

    public Double getDistanceM() {
        return distanceM;
    }

    public boolean isFlagged() {
        return flagged;
    }

    public enum CheckInMethod {
        QR, GEOFENCE, MANUAL
    }

    /** FR-ATT-13: without this, a trainer's own workout inflates both
     *  trainer utilisation and member footfall, and every operational figure
     *  drifts once staff start training on site. */
    public enum CheckInPurpose {
        SHIFT, PERSONAL_WORKOUT, BOTH
    }
}
