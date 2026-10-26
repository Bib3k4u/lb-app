package com.limitbeyond.training.domain;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class WorkoutLogTest {
    @Test
    void completingTheFinalSetCompletesTheWorkoutAndUncheckingASetReopensIt() {
        WorkoutLog workout = new WorkoutLog(UUID.randomUUID(), UUID.randomUUID(), null, null,
                "Pull day", null, new String[]{"Back"}, Instant.now(), 45, null, UUID.randomUUID().toString());
        UUID exerciseId = UUID.randomUUID();
        workout.addSet(new WorkoutLog.WorkoutSetDraft(exerciseId, 1, 10, null, null, null, null));
        workout.addSet(new WorkoutLog.WorkoutSetDraft(exerciseId, 2, 10, null, null, null, null));

        workout.markSet(workout.getSets().get(0).getId(), true);
        assertFalse(workout.isCompleted());

        workout.markSet(workout.getSets().get(1).getId(), true);
        assertTrue(workout.isCompleted());
        assertNotNull(workout.getCompletedAt());

        workout.markSet(workout.getSets().get(0).getId(), false);
        assertFalse(workout.isCompleted());
        assertNull(workout.getCompletedAt());
    }

    @Test
    void editingPreservesExistingCompletionAndLeavesNewSetsIncomplete() {
        WorkoutLog workout = new WorkoutLog(UUID.randomUUID(), UUID.randomUUID(), null, null,
                "Push day", null, new String[]{"Chest"}, Instant.now(), 45, null, UUID.randomUUID().toString());
        UUID bench = UUID.randomUUID();
        UUID fly = UUID.randomUUID();
        workout.addSet(new WorkoutLog.WorkoutSetDraft(bench, 1, 10, null, null, null, null));
        workout.addSet(new WorkoutLog.WorkoutSetDraft(bench, 2, 10, null, null, null, null));
        workout.markSet(workout.getSets().get(0).getId(), true);
        var completed = workout.completedSetKeys();

        workout.clearSets();
        workout.replace("Push day", null, new String[]{"Chest"}, Instant.now(), 50, null, null,
                java.util.List.of(
                        new WorkoutLog.WorkoutSetDraft(bench, 1, 12, null, null, null, null),
                        new WorkoutLog.WorkoutSetDraft(bench, 2, 12, null, null, null, null),
                        new WorkoutLog.WorkoutSetDraft(fly, 1, 12, null, null, null, null)));
        workout.restoreCompletedSets(completed);

        assertTrue(workout.getSets().get(0).isCompleted());
        assertFalse(workout.getSets().get(1).isCompleted());
        assertFalse(workout.getSets().get(2).isCompleted());
        assertFalse(workout.isCompleted());
    }

    @Test
    void completingOneExerciseOnlyMarksItsSetsAndCompletesWorkoutAfterTheLastExercise() {
        WorkoutLog workout = new WorkoutLog(UUID.randomUUID(), UUID.randomUUID(), null, null,
                "Upper body", null, new String[]{"Back", "Biceps"}, Instant.now(), 45, null, UUID.randomUUID().toString());
        UUID rows = UUID.randomUUID();
        UUID curls = UUID.randomUUID();
        workout.addSet(new WorkoutLog.WorkoutSetDraft(rows, 1, 10, null, null, null, null));
        workout.addSet(new WorkoutLog.WorkoutSetDraft(rows, 2, 10, null, null, null, null));
        workout.addSet(new WorkoutLog.WorkoutSetDraft(curls, 1, 12, null, null, null, null));

        workout.completeExercise(rows);
        assertTrue(workout.getSets().get(0).isCompleted());
        assertTrue(workout.getSets().get(1).isCompleted());
        assertFalse(workout.getSets().get(2).isCompleted());
        assertFalse(workout.isCompleted());

        workout.completeExercise(curls);
        assertTrue(workout.isCompleted());
    }
}
