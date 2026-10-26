package com.limitbeyond.billing.internal;

import com.limitbeyond.billing.api.MembershipFacade;
import com.limitbeyond.billing.domain.Plan;
import com.limitbeyond.billing.persistence.PlanRepository;
import com.limitbeyond.billing.persistence.MembershipRepository;
import com.limitbeyond.billing.domain.Membership;
import com.limitbeyond.billing.web.BillingDtos;
import com.limitbeyond.people.api.MemberFacade;
import com.limitbeyond.shared.error.DomainException;
import com.limitbeyond.shared.error.ErrorCode;
import com.limitbeyond.shared.rls.AuthContext;
import com.limitbeyond.shared.rls.AuthContextHolder;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** LB-SRS-1.1 M5, scoped narrow — see LB-DATA-1.0 V7's own note on why. */
@Service
public class BillingService {

    private final PlanRepository planRepository;
    private final MembershipRepository membershipRepository;
    private final MemberFacade memberFacade;
    private final MembershipFacade membershipFacade;

    public BillingService(
            PlanRepository planRepository,
            MembershipRepository membershipRepository,
            MemberFacade memberFacade,
            MembershipFacade membershipFacade) {
        this.planRepository = planRepository;
        this.membershipRepository = membershipRepository;
        this.memberFacade = memberFacade;
        this.membershipFacade = membershipFacade;
    }

    /** FR-ORG-12: pricing is gym-wide, reserved to the Gym Owner — genuinely
     *  reserved, not "or the platform": a plan is always scoped to exactly
     *  one gym ({@code gym_id NOT NULL}), and this method has no parameter
     *  for a platform Super Admin (whose own {@link AuthContext} carries no
     *  gym id at all — see {@code AuthContext.superAdmin}) to say which
     *  gym's catalogue they mean. Returns the new id, not the entity — the
     *  controller has no reason to touch a Plan getter
     *  (ArchitectureRulesTest.controllersMustNotReturnEntities). */
    @Transactional
    public UUID createPlan(String name, int durationMonths, long priceMinor) {
        AuthContext caller = AuthContextHolder.get();
        if (!caller.gymWide()) {
            throw DomainException.forbidden("manage the plan catalogue");
        }
        return planRepository.save(new Plan(caller.gymId(), name, durationMonths, priceMinor)).getId();
    }

    /** V7's own note: "readable by any staff of the gym at any location" —
     *  no gymWide/admin check here, just membership in the gym at all. */
    @Transactional(readOnly = true)
    public List<BillingDtos.PlanSummary> listPlans() {
        UUID gymId = AuthContextHolder.get().gymId();
        return planRepository.findByGymIdAndActiveTrueOrderByPriceMinorAsc(gymId).stream()
                .map(p -> new BillingDtos.PlanSummary(
                        p.getId(), p.getName(), p.getDurationMonths(), p.getPriceMinor(), p.getCurrency(),
                        membershipRepository.countByPlanIdAndState(p.getId(), Membership.MembershipState.ACTIVE)))
                .toList();
    }

    @Transactional
    public void updatePlan(UUID planId, String name, int durationMonths, long priceMinor) {
        Plan plan = requireManageablePlan(planId);
        requireUnassigned(plan);
        plan.update(name, durationMonths, priceMinor);
        planRepository.save(plan);
    }

    @Transactional
    public void deletePlan(UUID planId) {
        Plan plan = requireManageablePlan(planId);
        requireUnassigned(plan);
        plan.deactivate();
        planRepository.save(plan);
    }

    /**
     * FR-BIL-02: sells a plan to a member — a member holds at most one
     * active plan at a time.
     *
     * <p>Note the authorisation check here is coarse ("some kind of admin
     * somewhere"), not "an admin at this specific member's location" — a
     * genuine simplification for this pass, not an oversight. The finer
     * check is still enforced, by RLS: {@code memberships}' policy joins to
     * {@code member_records} and requires the caller's gym (and, unless
     * gym-wide, location) to match the member's, so a cross-gym or
     * cross-location sale is rejected at the database regardless of what
     * this method alone would have allowed.
     */
    @Transactional
    public UUID sellMembership(UUID memberRecordId, UUID planId, LocalDate startsOn) {
        AuthContext caller = AuthContextHolder.get();
        if (!caller.isAdmin()) {
            throw DomainException.forbidden("record a membership sale");
        }
        return membershipFacade.sellMembership(memberRecordId, planId, startsOn);
    }

    /** The member-facing counterpart to the roster's per-person membership
     *  view — same underlying facade call, just resolved for the CALLER
     *  themselves rather than for someone an admin is looking up. Empty for
     *  a non-member (staff with no member_records row at all) or someone
     *  with no gym context. */
    @Transactional(readOnly = true)
    public Optional<BillingDtos.MembershipView> myMembership() {
        AuthContext caller = AuthContextHolder.get();
        if (caller.gymId() == null) {
            return Optional.empty();
        }
        return memberFacade.findByUserAndGym(caller.userId(), caller.gymId())
                .flatMap(m -> membershipFacade.currentMembership(m.memberRecordId()))
                .map(m -> new BillingDtos.MembershipView(
                        m.planName(), m.startsOn(), m.expiresOn(), m.state(), m.currentlyActive()));
    }

    private Plan requireManageablePlan(UUID planId) {
        AuthContext caller = AuthContextHolder.get();
        if (!caller.gymWide() || caller.gymId() == null) {
            throw DomainException.forbidden("manage the plan catalogue");
        }
        return planRepository.findById(planId)
                .filter(Plan::isActive)
                .filter(plan -> caller.gymId().equals(plan.getGymId()))
                .orElseThrow(() -> DomainException.notFound("Plan"));
    }

    private void requireUnassigned(Plan plan) {
        long assigned = membershipRepository.countByPlanIdAndState(
                plan.getId(), Membership.MembershipState.ACTIVE);
        if (assigned > 0) {
            throw new DomainException(ErrorCode.CONFLICT,
                    "This plan is assigned to " + assigned
                            + (assigned == 1 ? " member. " : " members. ")
                            + "Revoke those memberships before editing or deleting it.");
        }
    }
}
