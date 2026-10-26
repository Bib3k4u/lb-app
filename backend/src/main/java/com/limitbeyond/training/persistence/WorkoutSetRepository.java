package com.limitbeyond.training.persistence;

import com.limitbeyond.training.domain.WorkoutSet;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkoutSetRepository extends JpaRepository<WorkoutSet, UUID> {
    boolean existsByExerciseId(UUID exerciseId);
}
