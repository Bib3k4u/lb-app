package com.limitbeyond.identity.persistence;

import com.limitbeyond.identity.domain.FitnessProfile;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FitnessProfileRepository extends JpaRepository<FitnessProfile, UUID> {
    Optional<FitnessProfile> findByUserId(UUID userId);
}
