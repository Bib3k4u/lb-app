package com.limitbeyond.identity.persistence;

import com.limitbeyond.identity.domain.TrainerAssignment;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TrainerAssignmentRepository extends JpaRepository<TrainerAssignment, UUID> {
    Optional<TrainerAssignment> findByMemberUserIdAndGymIdAndEndedAtIsNull(UUID memberUserId, UUID gymId);
    List<TrainerAssignment> findByGymIdAndEndedAtIsNull(UUID gymId);
    List<TrainerAssignment> findByTrainerUserIdAndGymIdAndEndedAtIsNull(UUID trainerUserId, UUID gymId);
}
