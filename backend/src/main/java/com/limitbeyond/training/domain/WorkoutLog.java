package com.limitbeyond.training.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Entity
@Table(name = "workout_logs")
public class WorkoutLog {
    @Id private UUID id;
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(name = "gym_id") private UUID gymId;
    @Column(name = "location_id") private UUID locationId;
    @Column(nullable = false) private String title;
    private String description;
    @Column(name = "trainer_user_id") private UUID trainerUserId;
    @Column(name = "target_muscle_groups", nullable = false, columnDefinition = "text[]")
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.ARRAY)
    private String[] targetMuscleGroups;
    @Column(name = "performed_at", nullable = false) private Instant performedAt;
    @Column(name = "duration_minutes", nullable = false) private int durationMinutes;
    private String notes;
    @Column(nullable = false) private String status;
    @Column(name = "completed_at") private Instant completedAt;
    @Column(name = "idempotency_key", nullable = false) private String idempotencyKey;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @OneToMany(mappedBy = "workout", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("position ASC")
    private List<WorkoutSet> sets = new ArrayList<>();

    protected WorkoutLog() {}
    public WorkoutLog(UUID userId, UUID gymId, UUID locationId, UUID trainerUserId, String title, String description, String[] targetMuscleGroups, Instant performedAt, int durationMinutes, String notes, String idempotencyKey) {
        this.id = UUID.randomUUID(); this.userId = userId; this.gymId = gymId; this.locationId = locationId;
        this.trainerUserId = trainerUserId; this.title = title.trim(); this.description = clean(description); this.targetMuscleGroups = targetMuscleGroups == null ? new String[0] : targetMuscleGroups;
        this.performedAt = performedAt; this.durationMinutes = durationMinutes; this.notes = clean(notes);
        this.status = "PLANNED"; this.idempotencyKey = idempotencyKey; this.createdAt = Instant.now(); this.updatedAt = createdAt;
    }
    public void replace(String title, String description, String[] targetMuscleGroups, Instant performedAt, int durationMinutes, String notes, UUID locationId, List<WorkoutSetDraft> drafts) {
        this.title = title.trim(); this.description = clean(description); this.targetMuscleGroups = targetMuscleGroups == null ? new String[0] : targetMuscleGroups;
        this.performedAt = performedAt; this.durationMinutes = durationMinutes; this.notes = clean(notes); this.locationId = locationId;
        sets.clear(); drafts.forEach(d -> sets.add(new WorkoutSet(this, d.exerciseId(), d.setNumber(), sets.size() + 1, d.reps(), d.weightKg(), d.seconds(), d.rpe(), d.notes())));
        this.updatedAt = Instant.now();
    }
    public void addSet(WorkoutSetDraft d) { sets.add(new WorkoutSet(this, d.exerciseId(), d.setNumber(), nextPosition(), d.reps(), d.weightKg(), d.seconds(), d.rpe(), d.notes())); }
    public void addSets(List<WorkoutSetDraft> drafts) { drafts.forEach(this::addSet); this.updatedAt = Instant.now(); }
    public void clearSets() { sets.clear(); this.updatedAt = Instant.now(); }
    public Set<WorkoutSetKey> completedSetKeys() { return sets.stream().filter(WorkoutSet::isCompleted).map(s -> new WorkoutSetKey(s.getExerciseId(), s.getSetNumber())).collect(Collectors.toSet()); }
    public void restoreCompletedSets(Set<WorkoutSetKey> completed) { sets.forEach(s -> s.markCompleted(completed.contains(new WorkoutSetKey(s.getExerciseId(), s.getSetNumber())))); syncCompletionFromSets(); }
    public void removeExercise(UUID exerciseId) { sets.removeIf(set -> set.getExerciseId().equals(exerciseId)); this.updatedAt = Instant.now(); }
    public void markSet(UUID setId, boolean value) {
        WorkoutSet set=sets.stream().filter(s->s.getId().equals(setId)).findFirst().orElseThrow(()->new IllegalArgumentException("Set not found"));
        set.markCompleted(value);
        if (!sets.isEmpty() && sets.stream().allMatch(WorkoutSet::isCompleted)) {
            this.status = "COMPLETED";
            this.completedAt = Instant.now();
        } else if (isCompleted()) {
            this.status = "PLANNED";
            this.completedAt = null;
        }
        this.updatedAt=Instant.now();
    }
    public void completeExercise(UUID exerciseId) {
        boolean found = false;
        for (WorkoutSet set : sets) {
            if (set.getExerciseId().equals(exerciseId)) {
                set.markCompleted(true);
                found = true;
            }
        }
        if (!found) throw new IllegalArgumentException("Exercise not found");
        syncCompletionFromSets();
        this.updatedAt = Instant.now();
    }
    public void complete() { this.status = "COMPLETED"; this.completedAt = Instant.now(); this.sets.forEach(s -> s.markCompleted(true)); this.updatedAt = Instant.now(); }
    public void reopen() { this.status = "PLANNED"; this.completedAt = null; this.sets.forEach(s -> s.markCompleted(false)); this.updatedAt = Instant.now(); }
    public UUID getId() { return id; } public UUID getUserId() { return userId; } public UUID getLocationId() { return locationId; }
    public String getTitle() { return title; } public Instant getPerformedAt() { return performedAt; } public int getDurationMinutes() { return durationMinutes; }
    public String getDescription() { return description; } public UUID getTrainerUserId() { return trainerUserId; } public String[] getTargetMuscleGroups() { return targetMuscleGroups.clone(); }
    public String getNotes() { return notes; } public List<WorkoutSet> getSets() { return List.copyOf(sets); }
    public boolean isCompleted() { return "COMPLETED".equals(status); } public Instant getCompletedAt() { return completedAt; }
    private int nextPosition() { return sets.stream().mapToInt(WorkoutSet::getPosition).max().orElse(0) + 1; }
    private String clean(String value){return value==null||value.isBlank()?null:value.trim();}
    public record WorkoutSetKey(UUID exerciseId, int setNumber) {}
    public record WorkoutSetDraft(UUID exerciseId, int setNumber, Integer reps, java.math.BigDecimal weightKg, Integer seconds, java.math.BigDecimal rpe, String notes) {}

    private void syncCompletionFromSets() {
        if (!sets.isEmpty() && sets.stream().allMatch(WorkoutSet::isCompleted)) {
            this.status = "COMPLETED";
            if (this.completedAt == null) this.completedAt = Instant.now();
        } else {
            this.status = "PLANNED";
            this.completedAt = null;
        }
    }
}
