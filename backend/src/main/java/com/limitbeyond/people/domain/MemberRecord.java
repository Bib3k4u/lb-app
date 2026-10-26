package com.limitbeyond.people.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * The gym-specific facts about a person who is a member somewhere — never
 * their identity (that is {@code identity.domain.User}, gym-agnostic).
 * "Membership is a role, not an identity" (LB-DATA-1.0 §2.1): this table,
 * not a separate person record, is what makes a user a member of THIS gym.
 */
@Entity
@Table(name = "member_records")
public class MemberRecord {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "gym_id", nullable = false)
    private UUID gymId;

    @Column(name = "primary_location_id", nullable = false)
    private UUID primaryLocationId;

    @Column(name = "joined_on")
    private LocalDate joinedOn;

    @Column(name = "created_at")
    private Instant createdAt;

    protected MemberRecord() {
    }

    public MemberRecord(UUID userId, UUID gymId, UUID primaryLocationId) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.gymId = gymId;
        this.primaryLocationId = primaryLocationId;
        this.joinedOn = LocalDate.now();
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

    public UUID getPrimaryLocationId() {
        return primaryLocationId;
    }
}
