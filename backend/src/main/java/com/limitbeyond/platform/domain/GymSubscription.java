package com.limitbeyond.platform.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** FR-SUB-04: at most one LIVE row per gym, enforced both here (state
 *  transitions only ever produce one) and as a partial unique index. */
@Entity
@Table(name = "gym_subscriptions")
public class GymSubscription {

    @Id
    private UUID id;

    @Column(name = "gym_id", nullable = false)
    private UUID gymId;

    @Column(name = "offering_id", nullable = false)
    private UUID offeringId;

    @Column(name = "starts_on", nullable = false)
    private LocalDate startsOn;

    @Column(name = "expires_on", nullable = false)
    private LocalDate expiresOn;

    @Column(name = "grace_until_on", nullable = false)
    private LocalDate graceUntilOn;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "subscription_state")
    private SubscriptionState state = SubscriptionState.LIVE;

    protected GymSubscription() {
    }

    public GymSubscription(UUID gymId, UUID offeringId, LocalDate startsOn, int termMonths, int graceDays) {
        this.id = UUID.randomUUID();
        this.gymId = gymId;
        this.offeringId = offeringId;
        this.startsOn = startsOn;
        this.expiresOn = startsOn.plusMonths(termMonths);
        this.graceUntilOn = expiresOn.plusDays(graceDays);
    }

    public UUID getId() {
        return id;
    }

    public LocalDate getExpiresOn() {
        return expiresOn;
    }

    public enum SubscriptionState {
        PENDING, LIVE, GRACE, LAPSED, CANCELLED
    }
}
