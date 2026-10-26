package com.limitbeyond.training.domain;

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

@Entity
@Table(name = "exercises")
public class Exercise {
    @Id private UUID id;
    @Column(name = "gym_id") private UUID gymId;
    @Column(nullable = false) private String name;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "discipline") private Discipline discipline;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "experience_level") private Difficulty difficulty;
    @Column(nullable = false) private String instructions;
    @Column(name = "primary_muscle_group", nullable = false) private String primaryMuscleGroup;
    @Column(name = "secondary_muscle_group") private String secondaryMuscleGroup;
    @Column(name = "requires_weight", nullable = false) private boolean requiresWeight;
    @Column(name = "created_by_user_id") private UUID createdByUserId;
    @Column(name = "created_at", nullable = false) private Instant createdAt;

    protected Exercise() {}
    public Exercise(UUID gymId, String name, Discipline discipline, Difficulty difficulty, String instructions,
                    String primaryMuscleGroup, String secondaryMuscleGroup, boolean requiresWeight, UUID createdByUserId) {
        this.id = UUID.randomUUID(); this.gymId = gymId; this.name = name.trim(); this.discipline = discipline;
        this.difficulty = difficulty; this.instructions = instructions.trim(); this.primaryMuscleGroup = primaryMuscleGroup.trim();
        this.secondaryMuscleGroup = secondaryMuscleGroup == null || secondaryMuscleGroup.isBlank() ? null : secondaryMuscleGroup.trim();
        this.requiresWeight = requiresWeight; this.createdByUserId = createdByUserId; this.createdAt = Instant.now();
    }
    public void update(String name, Discipline discipline, Difficulty difficulty, String instructions,
                       String primaryMuscleGroup, String secondaryMuscleGroup, boolean requiresWeight) {
        this.name = name.trim(); this.discipline = discipline; this.difficulty = difficulty; this.instructions = instructions.trim();
        this.primaryMuscleGroup = primaryMuscleGroup.trim();
        this.secondaryMuscleGroup = secondaryMuscleGroup == null || secondaryMuscleGroup.isBlank() ? null : secondaryMuscleGroup.trim();
        this.requiresWeight = requiresWeight;
    }
    public UUID getId() { return id; }
    public String getName() { return name; }
    public Discipline getDiscipline() { return discipline; }
    public Difficulty getDifficulty() { return difficulty; }
    public String getInstructions() { return instructions; }
    public String getPrimaryMuscleGroup() { return primaryMuscleGroup; }
    public String getSecondaryMuscleGroup() { return secondaryMuscleGroup; }
    public boolean isRequiresWeight() { return requiresWeight; }
    public UUID getGymId() { return gymId; }
    public enum Discipline { STRENGTH, CARDIO, FUNCTIONAL, YOGA, MOBILITY, MEDITATION, DANCE }
    public enum Difficulty { BEGINNER, INTERMEDIATE, ADVANCED }
}
