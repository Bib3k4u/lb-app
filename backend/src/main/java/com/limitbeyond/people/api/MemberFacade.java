package com.limitbeyond.people.api;

import java.util.Optional;
import java.util.UUID;

/** What other modules may know about members, through this facade alone. */
public interface MemberFacade {

    /** Called once, from identity's registration flow, when a fresh
     *  role_grant is for MEMBER — never for TRAINER/ADMIN roles, which have
     *  no member_records row at all. */
    void createIfAbsent(UUID userId, UUID gymId, UUID primaryLocationId);

    Optional<MemberSummary> findByUserAndGym(UUID userId, UUID gymId);

    Optional<MemberSummary> findById(UUID memberRecordId);

    record MemberSummary(UUID memberRecordId, UUID userId, UUID gymId, UUID primaryLocationId) {
    }
}
