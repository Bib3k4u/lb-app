package com.limitbeyond.training.persistence;
import com.limitbeyond.training.domain.DietPlan;
import java.util.List; import java.util.Optional; import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface DietPlanRepository extends JpaRepository<DietPlan, UUID> { Optional<DietPlan> findByUserIdAndGymIdAndActiveTrue(UUID userId,UUID gymId); List<DietPlan> findByUserIdAndGymIdOrderByStartsOnDesc(UUID userId,UUID gymId); }
