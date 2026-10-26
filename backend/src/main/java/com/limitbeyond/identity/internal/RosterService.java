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
import java.util.List;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * "Who's at my gym" for an admin — every ACTIVE account holding a live
 * grant at the caller's gym (scoped to their own locations unless
 * gym-wide), with a MEMBER's current plan status attached. Deliberately a
 * separate class from VerificationService: that one owns the
 * approve/reject workflow and its PENDING_VERIFICATION queue; this one
 * is a read-only cross-module view (identity + people + billing) with no
 * workflow of its own.
 */
@Service
public class RosterService {

    private final RoleGrantRepository roleGrantRepository;
    private final UserRepository userRepository;
    private final MemberFacade memberFacade;
    private final MembershipFacade membershipFacade;
    private final com.limitbeyond.identity.persistence.TrainerAssignmentRepository trainerAssignmentRepository;
    private final UserRepository trainerUserRepository;
    private final FitnessProfileRepository fitnessProfileRepository;

    public RosterService(
            RoleGrantRepository roleGrantRepository,
            UserRepository userRepository,
            MemberFacade memberFacade,
            MembershipFacade membershipFacade,
            com.limitbeyond.identity.persistence.TrainerAssignmentRepository trainerAssignmentRepository,
            FitnessProfileRepository fitnessProfileRepository) {
        this.roleGrantRepository = roleGrantRepository;
        this.userRepository = userRepository;
        this.memberFacade = memberFacade;
        this.membershipFacade = membershipFacade;
        this.trainerAssignmentRepository = trainerAssignmentRepository;
        this.trainerUserRepository = userRepository;
        this.fitnessProfileRepository = fitnessProfileRepository;
    }

    @Transactional(readOnly = true)
    public List<RosterDtos.PersonSummary> activeRoster() {
        AuthContext caller = AuthContextHolder.get();
        // Trainers see the roster read-only — CONDUCT_PT_SESSION and
        // MARK_ATTENDANCE_FOR_OTHERS both need to know who's actually here,
        // even though isAdmin() itself deliberately excludes TRAINER
        // (they hold no approve/reject or write authority over anyone).
        if ((!caller.isAdmin() && !caller.hasRole("TRAINER")) || caller.gymId() == null) {
            throw DomainException.forbidden("view the roster");
        }

        List<RoleGrant> grants = roleGrantRepository.findByGymIdAndRevokedAtIsNull(caller.gymId());
        List<RoleGrant> visible = caller.gymWide()
                ? grants
                : grants.stream()
                        .filter(g -> g.isGymWide() || g.getLocationIds().stream().anyMatch(caller::appliesAt))
                        .toList();
        if (visible.isEmpty()) {
            return List.of();
        }

        Map<UUID, User> usersById = userRepository.findAllById(visible.stream().map(RoleGrant::getUserId).toList())
                .stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        return visible.stream()
                .map(g -> Map.entry(g, usersById.get(g.getUserId())))
                .filter(e -> e.getValue() != null
                        && (e.getValue().getState() == User.AccountState.ACTIVE
                        || e.getValue().getState() == User.AccountState.SUSPENDED))
                .map(e -> toSummary(e.getKey(), e.getValue(), caller.gymId()))
                .toList();
    }

    @Transactional
    public void deactivate(UUID targetUserId, String roleName) {
        RoleGrant grant = requireManageableGrant(targetUserId, roleName);
        User user = userRepository.findById(targetUserId)
                .orElseThrow(() -> DomainException.notFound("Account"));
        if (user.getState() != User.AccountState.ACTIVE) {
            throw new DomainException(ErrorCode.CONFLICT, "This account is already inactive.");
        }

        if (grant.getRole() == RoleGrant.Role.MEMBER) {
            UUID memberRecordId = memberFacade.findByUserAndGym(targetUserId, grant.getGymId())
                    .orElseThrow(() -> DomainException.notFound("Member profile"))
                    .memberRecordId();
            membershipFacade.cancelActiveMembership(memberRecordId);
        } else {
            trainerAssignmentRepository
                    .findByTrainerUserIdAndGymIdAndEndedAtIsNull(targetUserId, grant.getGymId())
                    .forEach(assignment -> {
                        assignment.end();
                        trainerAssignmentRepository.save(assignment);
                    });
        }

        user.suspend("Deactivated by gym administrator");
        userRepository.save(user);
    }

    @Transactional
    public void reactivate(UUID targetUserId, String roleName, UUID planId) {
        RoleGrant grant = requireManageableGrant(targetUserId, roleName);
        User user = userRepository.findById(targetUserId)
                .orElseThrow(() -> DomainException.notFound("Account"));
        if (user.getState() != User.AccountState.SUSPENDED) {
            throw new DomainException(ErrorCode.CONFLICT, "This account is not deactivated.");
        }

        if (grant.getRole() == RoleGrant.Role.MEMBER) {
            if (planId == null) {
                throw new DomainException(ErrorCode.VALIDATION_FAILED,
                        "Choose a membership plan before reactivating this member.");
            }
            UUID memberRecordId = memberFacade.findByUserAndGym(targetUserId, grant.getGymId())
                    .orElseThrow(() -> DomainException.notFound("Member profile"))
                    .memberRecordId();
            membershipFacade.sellMembership(memberRecordId, planId, LocalDate.now());
        } else if (planId != null) {
            throw new DomainException(ErrorCode.VALIDATION_FAILED,
                    "Trainers are reactivated directly and do not require a membership plan.");
        }

        user.activate();
        userRepository.save(user);
    }

    private RoleGrant requireManageableGrant(UUID targetUserId, String roleName) {
        AuthContext caller = AuthContextHolder.get();
        RoleGrant.Role role;
        try {
            role = RoleGrant.Role.valueOf(roleName);
        } catch (RuntimeException exception) {
            throw new DomainException(ErrorCode.VALIDATION_FAILED, "Only member or trainer accounts can be managed here.");
        }
        if (role != RoleGrant.Role.MEMBER && role != RoleGrant.Role.TRAINER) {
            throw new DomainException(ErrorCode.VALIDATION_FAILED, "Only member or trainer accounts can be managed here.");
        }
        return roleGrantRepository.findByUserIdAndRevokedAtIsNull(targetUserId).stream()
                .filter(grant -> grant.getRole() == role)
                .filter(grant -> caller.gymId() != null && caller.gymId().equals(grant.getGymId()))
                .filter(grant -> grant.isGymWide()
                        || grant.getLocationIds().stream().anyMatch(caller::appliesAt))
                .findFirst()
                .filter(grant -> caller.isAdmin())
                .orElseThrow(() -> DomainException.notFound("Account"));
    }

    private RosterDtos.PersonSummary toSummary(RoleGrant grant, User user, UUID gymId) {
        var memberRecord = grant.getRole() == RoleGrant.Role.MEMBER
                ? memberFacade.findByUserAndGym(user.getId(), gymId)
                : java.util.Optional.<MemberFacade.MemberSummary>empty();

        RosterDtos.MembershipInfo membership = memberRecord
                .flatMap(m -> membershipFacade.currentMembership(m.memberRecordId()))
                .map(m -> new RosterDtos.MembershipInfo(
                        m.planId(), m.planName(), m.expiresOn().toString(), m.state(), m.currentlyActive()))
                .orElse(null);

        var assignedTrainer = memberRecord
                .flatMap(m -> trainerAssignmentRepository.findByMemberUserIdAndGymIdAndEndedAtIsNull(user.getId(), gymId))
                .flatMap(a -> trainerUserRepository.findById(a.getTrainerUserId()).map(t -> TrainerAssignmentService.view(a, t)))
                .orElse(null);
        var fitness = fitnessProfileRepository.findByUserId(user.getId()).orElse(null);

        return new RosterDtos.PersonSummary(
                user.getId(), user.getFirstName(), user.getLastName(), user.getPhoneE164(), user.getEmail(),
                grant.getRole().name(), grant.isGymWide(), grant.getLocationIds().stream().toList(),
                user.getState().name(), grant.getGrantedAt(), membership,
                memberRecord.map(MemberFacade.MemberSummary::memberRecordId).orElse(null), assignedTrainer,
                user.getDateOfBirth(), user.getGender(),
                fitness == null ? null : fitness.getHeightCm(),
                fitness == null ? null : fitness.getExperienceLevel(),
                fitness == null ? null : fitness.getPrimaryGoal());
    }
}
