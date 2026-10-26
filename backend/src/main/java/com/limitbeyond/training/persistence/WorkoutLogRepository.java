package com.limitbeyond.training.persistence;
import com.limitbeyond.training.domain.WorkoutLog;
import java.util.List; import java.util.Optional; import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface WorkoutLogRepository extends JpaRepository<WorkoutLog, UUID> {
 List<WorkoutLog> findByUserIdOrderByPerformedAtDesc(UUID userId);
 Optional<WorkoutLog> findByIdAndUserId(UUID id, UUID userId);
 Optional<WorkoutLog> findByUserIdAndIdempotencyKey(UUID userId,String idempotencyKey);
}
