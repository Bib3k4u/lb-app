package com.limitbeyond.org.domain;

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
 * A hard isolation boundary (CON-09) — every operational table below this
 * point carries both {@code gym_id} and {@code location_id}.
 *
 * <p>The generated PostGIS {@code geo} column (LB-DATA-1.0 §4) is
 * deliberately NOT mapped here: it is {@code GENERATED ALWAYS AS (...) STORED}
 * from latitude/longitude, computed by Postgres and never written by the
 * application. Geofence distance checks reach it through a native query
 * (see {@code attendance.internal}), which needs no JPA mapping to do so.
 */
@Entity
@Table(name = "locations")
public class Location {

    @Id
    private UUID id;

    @Column(name = "gym_id", nullable = false)
    private UUID gymId;

    // citext: case-insensitive uniqueness per gym (LB-DATA-1.0); see Gym.slug
    // for why this has to be spelled out for Hibernate's schema validator.
    @Column(nullable = false, columnDefinition = "citext")
    private String slug;

    @Column(nullable = false)
    private String name;

    @Column(name = "address_line1", nullable = false)
    private String addressLine1;

    @Column(name = "address_line2")
    private String addressLine2;

    @Column(nullable = false)
    private String city;

    @Column(nullable = false)
    private String state;

    @Column(nullable = false)
    private String pincode;

    @Column(nullable = false)
    private double latitude;

    @Column(nullable = false)
    private double longitude;

    @Column(name = "checkin_radius_m", nullable = false)
    private int checkinRadiusM = 100;

    @Column(name = "phone_e164")
    private String phoneE164;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "approval_state", nullable = false, columnDefinition = "location_state")
    private LocationState approvalState = LocationState.PENDING_REVIEW;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "reviewed_by_user_id")
    private UUID reviewedByUserId;

    @Column(name = "rejection_reason")
    private String rejectionReason;

    @Column(name = "is_publicly_listed")
    private boolean publiclyListed = false;

    @Column(name = "closed_at")
    private Instant closedAt;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    protected Location() {
    }

    public Location(UUID gymId, String slug, String name, String addressLine1, String addressLine2,
            String city, String state, String pincode, double latitude, double longitude, String phoneE164) {
        // FR-ATT-02: a 5km "geofence" defeats the point — mirrored as a
        // database CHECK constraint too (DM-02).
        this.id = UUID.randomUUID();
        this.gymId = gymId;
        this.slug = slug;
        this.name = name;
        this.addressLine1 = addressLine1;
        this.addressLine2 = addressLine2;
        this.city = city;
        this.state = state;
        this.pincode = pincode;
        this.latitude = latitude;
        this.longitude = longitude;
        this.phoneE164 = phoneE164;
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void markInitialLocationApproved() {
        this.approvalState = LocationState.APPROVED;
        this.reviewedAt = Instant.now();
        this.updatedAt = this.reviewedAt;
    }

    public void update(String slug, String name, String addressLine1, String addressLine2,
            String city, String state, String pincode, double latitude, double longitude, String phoneE164) {
        this.slug = slug;
        this.name = name;
        this.addressLine1 = addressLine1;
        this.addressLine2 = addressLine2;
        this.city = city;
        this.state = state;
        this.pincode = pincode;
        this.latitude = latitude;
        this.longitude = longitude;
        this.phoneE164 = phoneE164;
        if (this.approvalState == LocationState.REJECTED) {
            this.approvalState = LocationState.PENDING_REVIEW;
            this.rejectionReason = null;
            this.reviewedAt = null;
            this.reviewedByUserId = null;
        }
        this.updatedAt = Instant.now();
    }

    public void review(boolean approved, UUID reviewerId, String reason) {
        if (approvalState != LocationState.PENDING_REVIEW) {
            throw new IllegalStateException("Only a pending location may be reviewed.");
        }
        this.approvalState = approved ? LocationState.APPROVED : LocationState.REJECTED;
        this.rejectionReason = approved ? null : reason;
        this.publiclyListed = approved;
        this.reviewedAt = Instant.now();
        this.reviewedByUserId = reviewerId;
        this.updatedAt = this.reviewedAt;
    }

    public void close() {
        if (closedAt != null) {
            throw new IllegalStateException("This location is already deleted.");
        }
        this.closedAt = Instant.now();
        this.publiclyListed = false;
        this.updatedAt = this.closedAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getGymId() {
        return gymId;
    }

    public String getSlug() {
        return slug;
    }

    public String getCity() {
        return city;
    }

    public String getName() {
        return name;
    }

    public String getAddressLine1() {
        return addressLine1;
    }

    public String getAddressLine2() {
        return addressLine2;
    }

    public String getState() {
        return state;
    }

    public String getPincode() {
        return pincode;
    }

    public String getPhoneE164() {
        return phoneE164;
    }

    public int getCheckinRadiusM() {
        return checkinRadiusM;
    }

    public double getLatitude() {
        return latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public LocationState getApprovalState() {
        return approvalState;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public boolean isClosed() {
        return closedAt != null;
    }

    public enum LocationState {
        PENDING_REVIEW, APPROVED, REJECTED
    }
}
