package com.limitbeyond.identity.internal;

import com.limitbeyond.identity.api.UserFacade;
import com.limitbeyond.identity.persistence.UserRepository;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class UserFacadeImpl implements UserFacade {

    private final UserRepository userRepository;

    UserFacadeImpl(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    // users is RLS-exempt (LB-DATA-1.0 §16) — no bypass needed, unlike
    // platform/org's facades reaching into RLS-protected tables.
    @Override
    @Transactional(readOnly = true)
    public Optional<UserContact> findContact(UUID userId) {
        return userRepository.findById(userId)
                .map(u -> new UserContact(u.getFirstName(), u.getLastName(), u.getPhoneE164(), u.getEmail()));
    }
}
