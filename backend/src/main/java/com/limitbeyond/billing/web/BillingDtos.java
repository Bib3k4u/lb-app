package com.limitbeyond.billing.web;

import java.util.UUID;

/** Public so identity.internal (roster) can construct a member's current
 *  plan/membership view directly — same pattern AuthDtos/PlatformDtos
 *  document. */
public final class BillingDtos {

    private BillingDtos() {
    }

    public record PlanSummary(
            UUID id, String name, int durationMonths, long priceMinor, String currency,
            long assignedMemberCount) {
    }

    public record MembershipView(
            String planName, java.time.LocalDate startsOn, java.time.LocalDate expiresOn, String state,
            boolean currentlyActive) {
    }
}
