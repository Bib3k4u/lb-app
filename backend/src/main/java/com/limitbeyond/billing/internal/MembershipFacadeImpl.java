package com.limitbeyond.billing.internal;

import com.limitbeyond.billing.api.MembershipFacade;
import com.limitbeyond.billing.domain.Membership;
import com.limitbeyond.billing.domain.Plan;
import com.limitbeyond.billing.persistence.MembershipRepository;
import com.limitbeyond.billing.persistence.PlanRepository;
import com.limitbeyond.shared.error.DomainException;
import com.limitbeyond.shared.error.ErrorCode;
import com.limitbeyond.shared.rls.AuthContext;
import com.limitbeyond.shared.rls.AuthContextHolder;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class MembershipFacadeImpl implements MembershipFacade {

    private final MembershipRepository membershipRepository;
    private final PlanRepository planRepository;

    MembershipFacadeImpl(MembershipRepository membershipRepository, PlanRepository planRepository) {
        this.membershipRepository = membershipRepository;
        this.planRepository = planRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasActiveMembership(UUID memberRecordId) {
        return membershipRepository.findByMemberRecordIdAndState(memberRecordId, Membership.MembershipState.ACTIVE)
                .map(Membership::isCurrentlyActive)
                .orElse(false);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<MembershipDetail> currentMembership(UUID memberRecordId) {
        return membershipRepository.findTopByMemberRecordIdOrderByCreatedAtDesc(memberRecordId)
                .map(m -> {
                    // Plans never move gyms or get deleted out from under a
                    // membership that references one — a missing plan row
                    // here would mean the catalogue itself was corrupted, not
                    // a case to handle gracefully.
                    Plan plan = planRepository.findById(m.getPlanId())
                            .orElseThrow(() -> new IllegalStateException(
                                    "Membership " + m.getId() + " references a missing plan " + m.getPlanId()));
                    return new MembershipDetail(m.getId(), plan.getId(), plan.getName(), m.getStartsOn(),
                            m.getExpiresOn(), m.getState().name(), m.isCurrentlyActive());
                });
    }

    @Override
    @Transactional
    public UUID sellMembership(UUID memberRecordId, UUID planId, LocalDate startsOn) {
        AuthContext caller = AuthContextHolder.get();
        if (!caller.isAdmin() || caller.gymId() == null) {
            throw DomainException.forbidden("record a membership sale");
        }

        Plan plan = planRepository.findById(planId).orElseThrow(() -> DomainException.notFound("Plan"));
        if (!caller.gymId().equals(plan.getGymId())) {
            throw DomainException.notFound("Plan");
        }
        if (!plan.isActive()) {
            throw new DomainException(ErrorCode.CONFLICT, "This membership plan is no longer active.");
        }

        membershipRepository.findByMemberRecordIdAndState(memberRecordId, Membership.MembershipState.ACTIVE)
                .ifPresent(existing -> {
                    throw new DomainException(ErrorCode.CONFLICT,
                            "This member already has an active membership.");
                });

        Membership membership = new Membership(
                memberRecordId, planId, startsOn, plan.getDurationMonths(), plan.getPriceMinor());
        return membershipRepository.save(membership).getId();
    }

    @Override
    @Transactional
    public void cancelActiveMembership(UUID memberRecordId) {
        membershipRepository.findByMemberRecordIdAndState(memberRecordId, Membership.MembershipState.ACTIVE)
                .ifPresent(membership -> {
                    membership.cancel();
                    membershipRepository.save(membership);
                });
    }
}
