package com.limitbeyond.identity.api;

import java.util.Optional;
import java.util.UUID;

/** What other modules may know about a user's basic identity/contact info,
 *  without reaching into identity.internal/identity.domain directly
 *  (LB-ENG-1.0 ENG-2.1). Currently just the one thing platform needs: who
 *  registered a given gym, for the Super Admin reviewing it. */
public interface UserFacade {

    Optional<UserContact> findContact(UUID userId);

    record UserContact(String firstName, String lastName, String phoneE164, String email) {
    }
}
