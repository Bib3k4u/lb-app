package com.limitbeyond.billing.persistence;

import com.limitbeyond.billing.domain.Plan;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlanRepository extends JpaRepository<Plan, UUID> {
    List<Plan> findByGymIdAndActiveTrueOrderByPriceMinorAsc(UUID gymId);
}
