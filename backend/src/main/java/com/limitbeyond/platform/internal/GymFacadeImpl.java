package com.limitbeyond.platform.internal;

import com.limitbeyond.platform.api.GymFacade;
import com.limitbeyond.platform.domain.Gym;
import com.limitbeyond.platform.persistence.GymRepository;
import com.limitbeyond.shared.rls.RlsContext;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class GymFacadeImpl implements GymFacade {

    private final GymRepository gymRepository;
    private final RlsContext rlsContext;

    GymFacadeImpl(GymRepository gymRepository, RlsContext rlsContext) {
        this.gymRepository = gymRepository;
        this.rlsContext = rlsContext;
    }

    // Bypassed: gyms' RLS policy matches "my own gym or a publicly listed
    // one" — but a prospective registrant, by definition, has no gym scope
    // yet and the gym they're registering against may not be publicly
    // listed (e.g. they got the id from an invite/QR code). isLive/exists
    // answer a bare boolean, not gym data, so this is safe; see
    // RlsContext#withSystemBypass.
    @Override
    @Transactional(readOnly = true)
    public boolean isLive(UUID gymId) {
        return rlsContext.withSystemBypass(() -> gymRepository.findById(gymId).map(Gym::isLive).orElse(false));
    }

    @Override
    @Transactional(readOnly = true)
    public boolean exists(UUID gymId) {
        return rlsContext.withSystemBypass(() -> gymRepository.existsById(gymId));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<String> displayName(UUID gymId) {
        return rlsContext.withSystemBypass(() -> gymRepository.findById(gymId)
                .map(g -> g.getTradingName() == null || g.getTradingName().isBlank() ? g.getLegalName() : g.getTradingName()));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<PendingGymRegistration> findPendingRegistrationFor(UUID registrantUserId) {
        return rlsContext.withSystemBypass(
                () -> gymRepository.findTopByRegisteredByUserIdOrderByCreatedAtDesc(registrantUserId)
                        .filter(g -> g.getState() != Gym.GymState.LIVE)
                        .map(g -> new PendingGymRegistration(g.getId(), g.getSlug(), g.getLegalName(), g.getState().name())));
    }
}
