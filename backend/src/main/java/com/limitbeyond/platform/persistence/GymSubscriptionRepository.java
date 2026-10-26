package com.limitbeyond.platform.persistence;

import com.limitbeyond.platform.domain.GymSubscription;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GymSubscriptionRepository extends JpaRepository<GymSubscription, UUID> {
    Optional<GymSubscription> findByGymIdAndStateOrderByExpiresOnDesc(UUID gymId, GymSubscription.SubscriptionState state);
}
