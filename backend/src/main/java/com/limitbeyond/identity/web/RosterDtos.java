package com.limitbeyond.identity.web;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Shared between the pending-approvals queue and the active roster — both
 *  are "people holding a grant at my gym," just filtered by account state
 *  and (for the roster) enriched with membership status. Public for the
 *  same reason AuthDtos is (see its own Javadoc): constructed directly by
 *  identity.internal services, not mapped by the controller. */
public final class RosterDtos {

    private RosterDtos() {
    }

    public record PersonSummary(
            UUID userId, String firstName, String lastName, String phoneE164, String email,
            String role, boolean gymWide, List<UUID> locationIds, String accountState,
            Instant grantedAt, MembershipInfo membership,
            // Null for anything but a MEMBER grant — this is what the app
            // needs to call POST /members/{id}/memberships against this
            // person; nothing else here identifies their member_records row.
            UUID memberRecordId, TrainerAssignmentDtos.AssignmentView assignedTrainer,
            java.time.LocalDate dateOfBirth, String gender, java.math.BigDecimal heightCm,
            String experienceLevel, String primaryGoal) {
    }

    public record MembershipInfo(UUID planId, String planName, String expiresOn, String state, boolean currentlyActive) {
    }
}
