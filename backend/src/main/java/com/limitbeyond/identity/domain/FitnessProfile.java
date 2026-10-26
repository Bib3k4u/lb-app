package com.limitbeyond.identity.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * FR-PFP-01: every account owns exactly one of these, unconditionally. 1:1
 * with {@link User}, created in the SAME transaction as the user — see
 * {@code AuthService.createAccount}, which is the only place a
 * {@code FitnessProfile} is ever constructed. No method anywhere accepts a
 * role or branches on one; a Gym Owner's row and a Member's row are
 * identical in shape.
 */
@Entity
@Table(name = "fitness_profiles")
public class FitnessProfile {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false, unique = true)
    private UUID userId;

    // precision/scale must match numeric(5,1) exactly: Hibernate's default
    // inference for an unannotated BigDecimal (precision 19, scale 2) would
    // otherwise fail schema validation against the declared column.
    @Column(name = "height_cm", precision = 5, scale = 1)
    private java.math.BigDecimal heightCm;

    @Column(name = "experience_level")
    private String experienceLevel;

    @Column(name = "primary_goal")
    private String primaryGoal;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    protected FitnessProfile() {
    }

    public FitnessProfile(UUID userId) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    /** Every parameter applied only if non-null/non-blank — a PATCH, like
     *  {@code User.updateProfile}, for the same onboarding-in-steps reason. */
    public void updateDetails(java.math.BigDecimal heightCm, String experienceLevel, String primaryGoal) {
        if (heightCm != null) {
            this.heightCm = heightCm;
        }
        if (experienceLevel != null && !experienceLevel.isBlank()) {
            this.experienceLevel = experienceLevel;
        }
        if (primaryGoal != null && !primaryGoal.isBlank()) {
            this.primaryGoal = primaryGoal;
        }
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public java.math.BigDecimal getHeightCm() {
        return heightCm;
    }

    public String getExperienceLevel() {
        return experienceLevel;
    }

    public String getPrimaryGoal() {
        return primaryGoal;
    }
}
