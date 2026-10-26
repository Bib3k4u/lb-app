package com.limitbeyond.training.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "workout_log_sets")
public class WorkoutSet {
    @Id private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "workout_log_id") private WorkoutLog workout;
    @Column(name = "exercise_id", nullable = false) private UUID exerciseId;
    @Column(name = "set_number", nullable = false) private int setNumber;
    @Column(nullable = false) private int position;
    private Integer reps;
    @Column(name = "weight_kg") private BigDecimal weightKg;
    private Integer seconds;
    private BigDecimal rpe;
    private String notes;
    @Column(insertable = false, updatable = false) private BigDecimal volume;
    @Column(nullable = false) private boolean completed;
    protected WorkoutSet() {}
    WorkoutSet(WorkoutLog workout, UUID exerciseId, int setNumber, int position, Integer reps, BigDecimal weightKg, Integer seconds, BigDecimal rpe, String notes) {
        this.id = UUID.randomUUID(); this.workout = workout; this.exerciseId = exerciseId; this.setNumber = setNumber;
        this.position = position;
        this.reps = reps; this.weightKg = weightKg; this.seconds = seconds; this.rpe = rpe; this.notes = notes;
        this.completed = false;
    }
    public UUID getId() { return id; }
    public UUID getExerciseId() { return exerciseId; } public int getSetNumber() { return setNumber; }
    public int getPosition() { return position; }
    public Integer getReps() { return reps; } public BigDecimal getWeightKg() { return weightKg; }
    public Integer getSeconds() { return seconds; } public BigDecimal getRpe() { return rpe; }
    public String getNotes() { return notes; } public BigDecimal getVolume() { return volume; }
    public boolean isCompleted() { return completed; }
    void markCompleted(boolean value) { this.completed = value; }
}
