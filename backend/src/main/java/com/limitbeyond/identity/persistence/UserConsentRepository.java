package com.limitbeyond.identity.persistence;

import com.limitbeyond.identity.domain.UserConsent;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserConsentRepository extends JpaRepository<UserConsent, UUID> {
}
