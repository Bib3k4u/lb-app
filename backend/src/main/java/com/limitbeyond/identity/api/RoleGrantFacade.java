package com.limitbeyond.identity.api;

import java.util.UUID;

/**
 * The one door into identity's authority model for other modules.
 * {@code platform} calls {@link #grantGymOwner} at the moment a gym is
 * activated (FR-AUTH-16: the registrant becomes Gym Owner ON ACTIVATION, not
 * at registration — no grant exists before this call).
 */
public interface RoleGrantFacade {

    void grantGymOwner(UUID userId, UUID gymId);

    boolean belongsToGym(UUID userId, UUID gymId);

    boolean hasRoleAt(UUID userId, UUID gymId, UUID locationId, String... roles);
}
