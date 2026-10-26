package com.limitbeyond.attendance.persistence;

import com.limitbeyond.attendance.domain.LocationQrSecret;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LocationQrSecretRepository extends JpaRepository<LocationQrSecret, UUID> {
    Optional<LocationQrSecret> findByLocationIdAndActiveTrue(UUID locationId);
}
