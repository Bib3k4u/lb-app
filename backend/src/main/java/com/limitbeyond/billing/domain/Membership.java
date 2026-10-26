package com.limitbeyond.billing.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** FR-BIL-02: at most one ACTIVE row per member, enforced both here and as a
 *  partial unique index (uq_memberships_active). */
@Entity
@Table(name = "memberships")
public class Membership {

    @Id
    private UUID id;

    @Column(name = "member_record_id", nullable = false)
    private UUID memberRecordId;

    @Column(name = "plan_id", nullable = false)
    private UUID planId;

    @Column(name = "starts_on", nullable = false)
    private LocalDate startsOn;

    @Column(name = "expires_on", nullable = false)
    private LocalDate expiresOn;

    @Column(name = "price_agreed_minor", nullable = false)
    private long priceAgreedMinor;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "membership_state")
    private MembershipState state = MembershipState.ACTIVE;

    @Column(name = "created_at")
    private Instant createdAt;

    protected Membership() {
    }

    public Membership(UUID memberRecordId, UUID planId, LocalDate startsOn, int durationMonths, long priceAgreedMinor) {
        this.id = UUID.randomUUID();
        this.memberRecordId = memberRecordId;
        this.planId = planId;
        this.startsOn = startsOn;
        this.expiresOn = startsOn.plusMonths(durationMonths);
        this.priceAgreedMinor = priceAgreedMinor;
        this.createdAt = Instant.now();
    }

    /** FR-ATT-06: active AND not yet expired — a row can be state=ACTIVE and
     *  still be past its expiry date until the (not-yet-built) nightly sweep
     *  transitions it, so both checks matter independently. */
    public boolean isCurrentlyActive() {
        return state == MembershipState.ACTIVE && !LocalDate.now().isAfter(expiresOn);
    }

    public UUID getId() {
        return id;
    }

    public UUID getMemberRecordId() {
        return memberRecordId;
    }

    public LocalDate getExpiresOn() {
        return expiresOn;
    }

    public UUID getPlanId() {
        return planId;
    }

    public LocalDate getStartsOn() {
        return startsOn;
    }

    public MembershipState getState() {
        return state;
    }

    public void cancel() {
        this.state = MembershipState.CANCELLED;
    }

    public enum MembershipState {
        PENDING, ACTIVE, FROZEN, EXPIRED, CANCELLED
    }
}
