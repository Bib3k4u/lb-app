package com.limitbeyond.identity.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * One unit of authority: a role, at a gym, over either every location
 * ({@link #gymWide}) or a named set ({@link #locationIds}) — FR-AUTH-11,
 * FR-AUTH-26, FR-AUTH-28. A user accumulates several of these rather than
 * holding a single role column, which is what lets Trainer + Location Admin
 * coexist on one account.
 */
@Entity
@Table(name = "role_grants")
public class RoleGrant {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    /** Null only for SUPER_ADMIN — see the CHECK constraint in V5. */
    @Column(name = "gym_id")
    private UUID gymId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "role_type")
    private Role role;

    @Column(name = "is_gym_wide", nullable = false)
    private boolean gymWide;

    @Column(name = "granted_by_user_id")
    private UUID grantedByUserId;

    @Column(name = "granted_at")
    private Instant grantedAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "revoked_reason")
    private String revokedReason;

    @ElementCollection(fetch = FetchType.EAGER)
    @jakarta.persistence.CollectionTable(name = "role_grant_locations", joinColumns = @jakarta.persistence.JoinColumn(name = "role_grant_id"))
    @Column(name = "location_id")
    private Set<UUID> locationIds = new HashSet<>();

    protected RoleGrant() {
    }

    private RoleGrant(UUID userId, UUID gymId, Role role, boolean gymWide, Set<UUID> locationIds, UUID grantedByUserId) {
        // FR-AUTH-17: a promotion that names no location has no safe
        // interpretation, so it is refused at construction rather than
        // defaulted to gym-wide.
        if (!gymWide && (locationIds == null || locationIds.isEmpty()) && role != Role.SUPER_ADMIN) {
            throw new IllegalArgumentException("A location-scoped grant must name at least one location.");
        }
        // FR-AUTH-18: only GYM_OWNER and SUPER_ADMIN may hold gym-wide scope.
        if (gymWide && role != Role.GYM_OWNER && role != Role.SUPER_ADMIN) {
            throw new IllegalArgumentException(role + " may not hold gym-wide scope.");
        }
        if (role != Role.SUPER_ADMIN && gymId == null) {
            throw new IllegalArgumentException("Every role except SUPER_ADMIN must be scoped to a gym.");
        }
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.gymId = gymId;
        this.role = role;
        this.gymWide = gymWide;
        this.locationIds = locationIds == null ? new HashSet<>() : new HashSet<>(locationIds);
        this.grantedByUserId = grantedByUserId;
        this.grantedAt = Instant.now();
    }

    public static RoleGrant gymWide(UUID userId, UUID gymId, Role role, UUID grantedByUserId) {
        return new RoleGrant(userId, gymId, role, true, Set.of(), grantedByUserId);
    }

    public static RoleGrant scopedToLocations(UUID userId, UUID gymId, Role role, Set<UUID> locationIds, UUID grantedByUserId) {
        return new RoleGrant(userId, gymId, role, false, locationIds, grantedByUserId);
    }

    public static RoleGrant superAdmin(UUID userId, UUID grantedByUserId) {
        return new RoleGrant(userId, null, Role.SUPER_ADMIN, false, Set.of(), grantedByUserId);
    }

    public void revoke(String reason) {
        this.revokedAt = Instant.now();
        this.revokedReason = reason;
    }

    public boolean isLive() {
        return revokedAt == null;
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

    public Role getRole() {
        return role;
    }

    public boolean isGymWide() {
        return gymWide;
    }

    public Set<UUID> getLocationIds() {
        return Set.copyOf(locationIds);
    }

    public Instant getGrantedAt() {
        return grantedAt;
    }

    public UUID getGrantedByUserId() {
        return grantedByUserId;
    }

    public enum Role {
        SUPER_ADMIN, GYM_OWNER, LOCATION_ADMIN, TRAINER, MEMBER
    }
}
