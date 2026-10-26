package com.limitbeyond.training.persistence;
import com.limitbeyond.training.domain.Exercise;
import java.util.List; import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository; import org.springframework.data.jpa.repository.Query;
public interface ExerciseRepository extends JpaRepository<Exercise, UUID> {
 @Query("select e from Exercise e where e.gymId is null or e.gymId = :gymId order by e.name") List<Exercise> available(UUID gymId);
}
