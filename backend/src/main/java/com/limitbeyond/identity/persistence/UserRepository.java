package com.limitbeyond.identity.persistence;

import com.limitbeyond.identity.domain.User;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByPhoneE164(String phoneE164);

    Optional<User> findByEmail(String email);
}
