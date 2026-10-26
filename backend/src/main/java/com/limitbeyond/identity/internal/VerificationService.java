package com.limitbeyond.identity.internal;

import com.limitbeyond.billing.api.MembershipFacade;
import com.limitbeyond.identity.domain.RoleGrant;
import com.limitbeyond.identity.domain.User;
import com.limitbeyond.identity.persistence.RoleGrantRepository;
import com.limitbeyond.identity.persistence.UserRepository;
import com.limitbeyond.identity.persistence.FitnessProfileRepository;
import com.limitbeyond.identity.web.RosterDtos;
import com.limitbeyond.people.api.MemberFacade;
import com.limitbeyond.shared.error.DomainException;
import com.limitbeyond.shared.error.ErrorCode;
import com.limitbeyond.shared.rls.AuthContext;
import com.limitbeyond.shared.rls.AuthContextHolder;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * FR-AUTH-08/09: an admin approves or rejects a person who registered at
 * their location. Account state (not the grant itself) is what FR-AUTH-09's
 * allowlist gates on, so approval means one thing: {@code PENDING_VERIFICATION
 * → ACTIVE}. Rejection revokes the specific grant that brought them here and
 * moves the account to {@code DEACTIVATED} with the reason recorded — the
 * account_state enum has no dedicated REJECTED value (LB-DATA-1.0 §19),
 * this is the closest honest fit.
 */
@Service
public class VerificationService {

    private final UserRepository userRepository;
    private final RoleGrantRepository roleGrantRepository;
    private final MemberFacade memberFacade;
    private final MembershipFacade membershipFacade;
    private final FitnessProfileRepository fitnessProfileRepository;

    public VerificationService(
            UserRepository userRepository,
            RoleGrantRepository roleGrantRepository,
            MemberFacade memberFacade,
            MembershipFacade membershipFacade,
            FitnessProfileRepository fitnessProfileRepository) {
        this.userRepository = userRepository;
        this.roleGrantRepository = roleGrantRepository;
        this.memberFacade = memberFacade;
        this.membershipFacade = membershipFacade;
        this.fitnessProfileRepository = fitnessProfileRepository;
    }

    @Transactional
    public void approve(UUID targetUserId, UUID planId) {
        RoleGrant grant = requireCallerCanAdministerTargetsGrant(targetUserId);
        User user = userRepository.findById(targetUserId).orElseThrow(() -> DomainException.notFound("Account"));

        if (user.getState() != User.AccountState.PENDING_VERIFICATION) {
            throw new DomainException(ErrorCode.CONFLICT, "This account is no longer awaiting approval.");
        }

        // A member must leave approval with a usable membership. Creating the
        // membership inside this transaction means a bad/missing plan cannot
        // activate the account and leave it in a half-finished state. Staff
        // accounts deliberately require no plan (FR-BIL-16).
        if (grant.getRole() == RoleGrant.Role.MEMBER) {
            if (planId == null) {
                throw new DomainException(ErrorCode.VALIDATION_FAILED,
                        "Choose a membership plan before approving this member.");
            }
            UUID memberRecordId = memberFacade.findByUserAndGym(targetUserId, grant.getGymId())
                    .orElseThrow(() -> DomainException.notFound("Member profile"))
                    .memberRecordId();
            membershipFacade.sellMembership(memberRecordId, planId, LocalDate.now());
        } else if (planId != null) {
            throw new DomainException(ErrorCode.VALIDATION_FAILED,
                    "Membership plans can only be assigned to member registrations.");
        }

        user.activate();
        userRepository.save(user);
    }

    @Transactional
    public void reject(UUID targetUserId, String reason) {
        RoleGrant grant = requireCallerCanAdministerTargetsGrant(targetUserId);
        grant.revoke(reason);
        roleGrantRepository.save(grant);

        User user = userRepository.findById(targetUserId).orElseThrow(() -> DomainException.notFound("Account"));
        user.suspend(reason); // DEACTIVATED is the closest fit — see class Javadoc
        userRepository.save(user);
    }

    /** FR-AUTH-08's other half: an admin cannot approve or reject anyone
     *  without first seeing who's waiting. Scoped exactly like
     *  requireCallerCanAdministerTargetsGrant below — gym-wide sees every
     *  pending grant at the gym, a location-scoped admin sees only grants
     *  touching their own locations. */
    @Transactional(readOnly = true)
    public List<RosterDtos.PersonSummary> pendingApprovals() {
        AuthContext caller = AuthContextHolder.get();
        if (!caller.isAdmin() || caller.gymId() == null) {
            throw DomainException.forbidden("view pending approvals");
        }

        List<RoleGrant> visible = visibleGrants(caller);
        if (visible.isEmpty()) {
            return List.of();
        }

        Map<UUID, User> usersById = userRepository.findAllById(visible.stream().map(RoleGrant::getUserId).toList())
                .stream()
                .collect(java.util.stream.Collectors.toMap(User::getId, u -> u));

        return visible.stream()
                .map(g -> Map.entry(g, usersById.get(g.getUserId())))
                .filter(e -> e.getValue() != null && e.getValue().getState() == User.AccountState.PENDING_VERIFICATION)
                .map(e -> {
                    User u = e.getValue();
                    RoleGrant g = e.getKey();
                    var fitness = fitnessProfileRepository.findByUserId(u.getId()).orElse(null);
                    return new RosterDtos.PersonSummary(
                            u.getId(), u.getFirstName(), u.getLastName(), u.getPhoneE164(), u.getEmail(),
                            g.getRole().name(), g.isGymWide(), g.getLocationIds().stream().toList(),
                            u.getState().name(), g.getGrantedAt(), null, null, null,
                            u.getDateOfBirth(), u.getGender(),
                            fitness == null ? null : fitness.getHeightCm(),
                            fitness == null ? null : fitness.getExperienceLevel(),
                            fitness == null ? null : fitness.getPrimaryGoal());
                })
                .toList();
    }

    /** The location-scoping rule shared by every "who's at my gym" read:
     *  gym-wide sees everything, otherwise only grants touching a location
     *  the caller themselves is allowed at. */
    private List<RoleGrant> visibleGrants(AuthContext caller) {
        List<RoleGrant> grants = roleGrantRepository.findByGymIdAndRevokedAtIsNull(caller.gymId());
        if (caller.gymWide()) {
            return grants;
        }
        return grants.stream()
                .filter(g -> g.isGymWide() || g.getLocationIds().stream().anyMatch(caller::appliesAt))
                .toList();
    }

    /** NN-5: scope checked before anything else. Returns the specific grant
     *  being acted on, since both approve and reject need it — approve to
     *  confirm one truly exists at a location the caller administers, reject
     *  to revoke it. */
    private RoleGrant requireCallerCanAdministerTargetsGrant(UUID targetUserId) {
        AuthContext caller = AuthContextHolder.get();
        List<RoleGrant> targetGrants = roleGrantRepository.findByUserIdAndRevokedAtIsNull(targetUserId);

        return targetGrants.stream()
                .filter(g -> caller.gymId() != null && caller.gymId().equals(g.getGymId()))
                .filter(g -> g.isGymWide() || g.getLocationIds().stream().anyMatch(caller::appliesAt))
                .findFirst()
                .filter(g -> caller.isAdmin())
                .orElseThrow(() -> DomainException.notFound("A pending registration for this account, at a location you administer,"));
    }
}
