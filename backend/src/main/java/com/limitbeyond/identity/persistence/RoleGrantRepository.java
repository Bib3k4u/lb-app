package com.limitbeyond.identity.persistence;

import com.limitbeyond.identity.domain.RoleGrant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoleGrantRepository extends JpaRepository<RoleGrant, UUID> {

    /** Every live grant a user holds, across every gym — what JwtService
     *  encodes into an access token at sign-in. */
    List<RoleGrant> findByUserIdAndRevokedAtIsNull(UUID userId);

    List<RoleGrant> findByGymIdAndRevokedAtIsNull(UUID gymId);

    long countByGymIdAndRoleAndRevokedAtIsNull(UUID gymId, RoleGrant.Role role);
}
