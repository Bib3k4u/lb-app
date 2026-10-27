package com.limitbeyond.platform.api;

import java.util.Optional;
import java.util.UUID;

/**
 * What other modules may know about a gym, without reaching into
 * {@code platform.internal}/{@code platform.domain} directly (LB-ENG-1.0
 * ENG-2.1 — only {@code api/} is public).
 */
public interface GymFacade {

    /** FR-AUTH-07: no registration may proceed against a gym that is not live. */
    boolean isLive(UUID gymId);

    boolean exists(UUID gymId);

    /** Trading name, falling back to the legal name; empty if the gym is gone. */
    Optional<String> displayName(UUID gymId);

    /**
     * The gym this person registered, if it exists and isn't LIVE yet —
     * empty once it goes live, since FR-AUTH-16's activation grants them
     * GYM_OWNER at that exact moment, which is a stronger, already-present
     * signal the client can key off of instead. Lets {@code identity}'s
     * MeResponse tell "hasn't chosen a path yet" apart from "started a gym,
     * still waiting on the Super Admin" — both are zero-grant states
     * otherwise indistinguishable to the app.
     */
    Optional<PendingGymRegistration> findPendingRegistrationFor(UUID registrantUserId);

    record PendingGymRegistration(UUID id, String slug, String legalName, String state) {
    }
}
