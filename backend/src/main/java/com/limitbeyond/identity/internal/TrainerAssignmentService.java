package com.limitbeyond.identity.internal;

import com.limitbeyond.identity.domain.RoleGrant;
import com.limitbeyond.identity.domain.TrainerAssignment;
import com.limitbeyond.identity.domain.User;
import com.limitbeyond.identity.persistence.RoleGrantRepository;
import com.limitbeyond.identity.persistence.TrainerAssignmentRepository;
import com.limitbeyond.identity.persistence.UserRepository;
import com.limitbeyond.identity.web.TrainerAssignmentDtos;
import com.limitbeyond.people.api.MemberFacade;
import com.limitbeyond.shared.error.DomainException;
import com.limitbeyond.shared.rls.AuthContext;
import com.limitbeyond.shared.rls.AuthContextHolder;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TrainerAssignmentService {
    private final TrainerAssignmentRepository assignments;
    private final RoleGrantRepository grants;
    private final UserRepository users;
    private final MemberFacade members;

    public TrainerAssignmentService(TrainerAssignmentRepository assignments, RoleGrantRepository grants,
            UserRepository users, MemberFacade members) {
        this.assignments = assignments;
        this.grants = grants;
        this.users = users;
        this.members = members;
    }

    @Transactional(readOnly = true)
    public List<TrainerAssignmentDtos.TrainerSummary> trainersAt(UUID locationId) {
        AuthContext caller = requireAdminAt(locationId);
        return grants.findByGymIdAndRevokedAtIsNull(caller.gymId()).stream()
                .filter(g -> g.getRole() == RoleGrant.Role.TRAINER)
                .filter(g -> g.isGymWide() || g.getLocationIds().contains(locationId))
                .map(RoleGrant::getUserId).distinct().map(users::findById).flatMap(java.util.Optional::stream)
                .filter(u -> u.getState() == User.AccountState.ACTIVE)
                .map(u -> new TrainerAssignmentDtos.TrainerSummary(u.getId(), u.getFirstName(), u.getLastName(), u.getPhoneE164(), u.getEmail()))
                .toList();
    }

    @Transactional
    public TrainerAssignmentDtos.AssignmentView assign(UUID memberRecordId, UUID trainerUserId) {
        var member = members.findById(memberRecordId).orElseThrow(() -> DomainException.notFound("Member"));
        AuthContext caller = requireAdminAt(member.primaryLocationId());
        if (!member.gymId().equals(caller.gymId())) throw DomainException.notFound("Member");
        boolean trainerAtLocation = grants.findByUserIdAndRevokedAtIsNull(trainerUserId).stream()
                .anyMatch(g -> g.getRole() == RoleGrant.Role.TRAINER && member.gymId().equals(g.getGymId())
                        && (g.isGymWide() || g.getLocationIds().contains(member.primaryLocationId())));
        if (!trainerAtLocation) throw DomainException.notFound("Trainer");
        User trainer = users.findById(trainerUserId).filter(u -> u.getState() == User.AccountState.ACTIVE)
                .orElseThrow(() -> DomainException.notFound("Trainer"));
        assignments.findByMemberUserIdAndGymIdAndEndedAtIsNull(member.userId(), member.gymId()).ifPresent(TrainerAssignment::end);
        assignments.flush();
        TrainerAssignment saved = assignments.save(new TrainerAssignment(member.userId(), trainerUserId, member.gymId(), member.primaryLocationId(), caller.userId()));
        return view(saved, trainer);
    }

    @Transactional
    public void unassign(UUID memberRecordId) {
        var member = members.findById(memberRecordId).orElseThrow(() -> DomainException.notFound("Member"));
        AuthContext caller = requireAdminAt(member.primaryLocationId());
        if (!member.gymId().equals(caller.gymId())) throw DomainException.notFound("Member");
        java.util.Optional.of(member.userId())
                .flatMap(id -> assignments.findByMemberUserIdAndGymIdAndEndedAtIsNull(id, member.gymId()))
                .ifPresent(TrainerAssignment::end);
    }

    private AuthContext requireAdminAt(UUID locationId) {
        AuthContext caller = AuthContextHolder.get();
        if (caller.gymId() == null || !caller.isAllowed(locationId, "GYM_OWNER", "LOCATION_ADMIN")) {
            throw DomainException.forbidden("manage trainer assignments");
        }
        return caller;
    }

    static TrainerAssignmentDtos.AssignmentView view(TrainerAssignment a, User trainer) {
        return new TrainerAssignmentDtos.AssignmentView(a.getTrainerUserId(), trainer.getFirstName(), trainer.getLastName(), a.getLocationId(), a.getAssignedAt());
    }
}
