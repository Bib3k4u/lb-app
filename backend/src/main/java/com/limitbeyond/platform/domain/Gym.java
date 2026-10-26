package com.limitbeyond.platform.domain;

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
import com.limitbeyond.shared.error.DomainException;
import com.limitbeyond.shared.error.ErrorCode;

/**
 * The tenant root. Verification and activation are deliberately separate
 * (FR-SUB-03): a gym can be a legitimate business (verified) and still not
 * be entitled to operate because its subscription has not been paid.
 */
@Entity
@Table(name = "gyms")
public class Gym {

    @Id
    private UUID id;

    // citext, not varchar: slugs are case-insensitively unique (LB-DATA-1.0),
    // and Hibernate's schema validator checks the declared type against the
    // actual column, so it has to be told — its own inference from a plain
    // String would otherwise expect varchar and fail validation at boot.
    @Column(nullable = false, unique = true, columnDefinition = "citext")
    private String slug;

    @Column(name = "legal_name", nullable = false)
    private String legalName;

    @Column(name = "trading_name")
    private String tradingName;

    private String gstin;

    // A genuine Postgres enum type (gym_state), not a plain varchar column —
    // NAMED_ENUM + columnDefinition tell Hibernate to bind/validate against
    // it as such, matching how V3 declared the column. See Gym.slug for why
    // this class of thing has to be spelled out rather than inferred.
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "gym_state")
    private GymState state = GymState.PENDING_VERIFICATION;

    private String timezone = "Asia/Kolkata";
    private String currency = "INR";

    @Column(name = "is_publicly_listed")
    private boolean publiclyListed = false;

    @Column(name = "registered_by_user_id", nullable = false)
    private UUID registeredByUserId;

    @Column(name = "verified_at")
    private Instant verifiedAt;

    @Column(name = "verified_by_user_id")
    private UUID verifiedByUserId;

    @Column(name = "rejected_reason")
    private String rejectedReason;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    protected Gym() {
    }

    public Gym(String slug, String legalName, String tradingName, String gstin, UUID registeredByUserId) {
        if (slug == null || slug.isBlank()) {
            throw new IllegalArgumentException("A gym requires a slug.");
        }
        this.id = UUID.randomUUID();
        this.slug = slug;
        this.legalName = legalName;
        this.tradingName = tradingName;
        this.gstin = gstin;
        this.registeredByUserId = registeredByUserId;
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void verify(UUID verifiedByUserId) {
        if (state != GymState.PENDING_VERIFICATION) {
            throw new DomainException(ErrorCode.CONFLICT, "This gym has already been reviewed (currently " + state + ").");
        }
        this.state = GymState.VERIFIED;
        this.verifiedAt = Instant.now();
        this.verifiedByUserId = verifiedByUserId;
        this.updatedAt = Instant.now();
    }

    public void reject(String reason) {
        if (state != GymState.PENDING_VERIFICATION) {
            throw new DomainException(ErrorCode.CONFLICT, "This gym has already been reviewed (currently " + state + ").");
        }
        this.state = GymState.REJECTED;
        this.rejectedReason = reason;
        this.updatedAt = Instant.now();
    }

    public void goLive() {
        if (state != GymState.VERIFIED && state != GymState.LAPSED && state != GymState.LIVE) {
            throw new DomainException(ErrorCode.CONFLICT, "A gym must be verified before it can go live (currently " + state + ").");
        }
        this.state = GymState.LIVE;
        this.publiclyListed = true;
        this.updatedAt = Instant.now();
    }

    public void suspend(String reason) {
        if (state != GymState.LIVE) {
            throw new DomainException(ErrorCode.CONFLICT, "Only an active gym may be deactivated (currently " + state + ").");
        }
        this.state = GymState.SUSPENDED;
        this.rejectedReason = reason;
        this.publiclyListed = false;
        this.updatedAt = Instant.now();
    }

    public void reactivate() {
        if (state != GymState.SUSPENDED) {
            throw new DomainException(ErrorCode.CONFLICT, "Only a deactivated gym may be reactivated (currently " + state + ").");
        }
        this.state = GymState.LIVE;
        this.rejectedReason = null;
        this.publiclyListed = true;
        this.updatedAt = Instant.now();
    }

    public void close() {
        if (state == GymState.CLOSED) {
            throw new DomainException(ErrorCode.CONFLICT, "This gym is already closed.");
        }
        this.state = GymState.CLOSED;
        this.rejectedReason = null;
        this.publiclyListed = false;
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public String getSlug() {
        return slug;
    }

    public String getLegalName() {
        return legalName;
    }

    public String getTradingName() {
        return tradingName;
    }

    public String getGstin() {
        return gstin;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public GymState getState() {
        return state;
    }

    public UUID getRegisteredByUserId() {
        return registeredByUserId;
    }

    public boolean isLive() {
        return state == GymState.LIVE;
    }

    public enum GymState {
        PENDING_VERIFICATION, VERIFIED, LIVE, LAPSED, SUSPENDED, REJECTED, CLOSED
    }
}
