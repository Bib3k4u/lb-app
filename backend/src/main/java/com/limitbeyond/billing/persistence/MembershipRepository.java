package com.limitbeyond.billing.persistence;

import com.limitbeyond.billing.domain.Membership;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MembershipRepository extends JpaRepository<Membership, UUID> {
    Optional<Membership> findByMemberRecordIdAndState(UUID memberRecordId, Membership.MembershipState state);

    Optional<Membership> findTopByMemberRecordIdOrderByCreatedAtDesc(UUID memberRecordId);

    long countByPlanIdAndState(UUID planId, Membership.MembershipState state);
}
