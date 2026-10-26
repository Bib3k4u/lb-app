package com.limitbeyond.platform.persistence;

import com.limitbeyond.platform.domain.Gym;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GymRepository extends JpaRepository<Gym, UUID> {
    Optional<Gym> findBySlug(String slug);

    List<Gym> findByStateOrderByCreatedAtAsc(Gym.GymState state);

    List<Gym> findByStateInOrderByCreatedAtAsc(List<Gym.GymState> states);

    List<Gym> findAllByOrderByCreatedAtDesc();

    Optional<Gym> findTopByRegisteredByUserIdOrderByCreatedAtDesc(java.util.UUID registeredByUserId);

    boolean existsBySlug(String slug);
}
