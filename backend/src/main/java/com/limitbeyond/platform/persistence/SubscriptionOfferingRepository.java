package com.limitbeyond.platform.persistence;

import com.limitbeyond.platform.domain.SubscriptionOffering;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SubscriptionOfferingRepository extends JpaRepository<SubscriptionOffering, UUID> {
    Optional<SubscriptionOffering> findFirstByActiveTrueOrderByPriceMinorAsc();
}
