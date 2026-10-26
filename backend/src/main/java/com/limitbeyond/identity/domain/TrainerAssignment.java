package com.limitbeyond.identity.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "trainer_assignments")
public class TrainerAssignment {
    @Id private UUID id;
    @Column(name = "member_user_id", nullable = false) private UUID memberUserId;
    @Column(name = "trainer_user_id", nullable = false) private UUID trainerUserId;
    @Column(name = "gym_id", nullable = false) private UUID gymId;
    @Column(name = "location_id", nullable = false) private UUID locationId;
    @Column(name = "assigned_by_user_id", nullable = false) private UUID assignedByUserId;
    @Column(name = "assigned_at", nullable = false) private Instant assignedAt;
    @Column(name = "ended_at") private Instant endedAt;

    protected TrainerAssignment() {}

    public TrainerAssignment(UUID memberUserId, UUID trainerUserId, UUID gymId, UUID locationId, UUID assignedByUserId) {
        this.id = UUID.randomUUID();
        this.memberUserId = memberUserId;
        this.trainerUserId = trainerUserId;
        this.gymId = gymId;
        this.locationId = locationId;
        this.assignedByUserId = assignedByUserId;
        this.assignedAt = Instant.now();
    }

    public void end() { this.endedAt = Instant.now(); }
    public UUID getId() { return id; }
    public UUID getMemberUserId() { return memberUserId; }
    public UUID getTrainerUserId() { return trainerUserId; }
    public UUID getGymId() { return gymId; }
    public UUID getLocationId() { return locationId; }
    public Instant getAssignedAt() { return assignedAt; }
}
