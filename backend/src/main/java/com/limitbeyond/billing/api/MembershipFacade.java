package com.limitbeyond.billing.api;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

/** What other modules may know about billing, through this facade alone. */
public interface MembershipFacade {

    /** FR-ATT-06: check-in must refuse a member whose membership is not
     *  currently active. Returns true unconditionally for a caller with no
     *  member_records row at all — staff train without a plan (FR-BIL-16),
     *  and this facade cannot distinguish "no membership needed" from "not a
     *  member" on its own; that distinction is the caller's to make first. */
    boolean hasActiveMembership(UUID memberRecordId);

    /** The member's most recent membership row (any state, not just ACTIVE)
     *  — for a roster view, "expired last month" is as useful to show an
     *  admin as "currently active" is. Empty only when the member has never
     *  been sold a plan at all. */
    Optional<MembershipDetail> currentMembership(UUID memberRecordId);

    /** Creates the member's paid plan record after enforcing admin authority,
     *  plan availability and tenant/location scope. */
    UUID sellMembership(UUID memberRecordId, UUID planId, LocalDate startsOn);

    /** Cancels the member's current active membership, if one exists. */
    void cancelActiveMembership(UUID memberRecordId);

    record MembershipDetail(
            UUID membershipId, UUID planId, String planName, LocalDate startsOn, LocalDate expiresOn,
            String state, boolean currentlyActive) {
    }
}
