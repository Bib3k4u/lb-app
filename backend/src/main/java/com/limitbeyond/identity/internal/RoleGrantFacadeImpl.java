package com.limitbeyond.identity.internal;

import com.limitbeyond.identity.api.RoleGrantFacade;
import com.limitbeyond.identity.domain.RoleGrant;
import com.limitbeyond.identity.domain.User;
import com.limitbeyond.identity.persistence.RoleGrantRepository;
import com.limitbeyond.identity.persistence.UserRepository;
import com.limitbeyond.shared.error.DomainException;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class RoleGrantFacadeImpl implements RoleGrantFacade {

    private final RoleGrantRepository roleGrantRepository;
    private final UserRepository userRepository;

    RoleGrantFacadeImpl(RoleGrantRepository roleGrantRepository, UserRepository userRepository) {
        this.roleGrantRepository = roleGrantRepository;
        this.userRepository = userRepository;
    }

    @Override
    @Transactional
    public void grantGymOwner(UUID userId, UUID gymId) {
        // FR-AUTH-16: happens exactly once, at activation. grantedByUserId is
        // null — a Super Admin activating a gym isn't "granting" the way one
        // admin promotes another; it's the platform admitting the gym at all.
        roleGrantRepository.save(RoleGrant.gymWide(userId, gymId, RoleGrant.Role.GYM_OWNER, null));

        // Also activates the account itself, not just the grant. Every OTHER
        // self-registration (FR-AUTH-08/09) waits on an existing admin at the
        // gym to approve it — but a brand-new Gym Owner has no admin above
        // them at this gym to do that; they ARE the first one. Leaving their
        // account at PENDING_VERIFICATION would lock them out of everything
        // except /me indefinitely (see JwtAuthenticationFilter's restricted-
        // state allowlist), with no path forward. Same bootstrap shape as
        // DevSuperAdminSeedRunner activating its seeded admin directly.
        User user = userRepository.findById(userId).orElseThrow(() -> DomainException.notFound("Account"));
        user.activate();
        userRepository.save(user);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean belongsToGym(UUID userId, UUID gymId) {
        return roleGrantRepository.findByUserIdAndRevokedAtIsNull(userId).stream()
                .anyMatch(grant -> gymId.equals(grant.getGymId()));
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasRoleAt(UUID userId, UUID gymId, UUID locationId, String... roles) {
        java.util.Set<String> accepted = java.util.Set.of(roles);
        return roleGrantRepository.findByUserIdAndRevokedAtIsNull(userId).stream()
                .anyMatch(grant -> gymId.equals(grant.getGymId())
                        && accepted.contains(grant.getRole().name())
                        && (grant.isGymWide() || grant.getLocationIds().contains(locationId)));
    }
}
