package com.limitbeyond.platform.domain;

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

/** Append-only (DM-04) — cash the Super Admin recorded. Never updated or deleted. */
@Entity
@Table(name = "subscription_payments")
public class SubscriptionPayment {

    @Id
    private UUID id;

    @Column(name = "subscription_id", nullable = false)
    private UUID subscriptionId;

    @Column(name = "gym_id", nullable = false)
    private UUID gymId;

    @Column(name = "amount_minor", nullable = false)
    private long amountMinor;

    private String currency = "INR";

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "payment_method")
    private PaymentMethod method;

    private String reference;

    @Column(name = "received_on", nullable = false)
    private LocalDate receivedOn;

    @Column(name = "recorded_by_user_id", nullable = false)
    private UUID recordedByUserId;

    @Column(name = "idempotency_key", nullable = false)
    private String idempotencyKey;

    @Column(name = "created_at")
    private Instant createdAt;

    protected SubscriptionPayment() {
    }

    public SubscriptionPayment(UUID subscriptionId, UUID gymId, long amountMinor, PaymentMethod method,
            String reference, LocalDate receivedOn, UUID recordedByUserId, String idempotencyKey) {
        if (amountMinor <= 0) {
            throw new IllegalArgumentException("amountMinor must be positive.");
        }
        this.id = UUID.randomUUID();
        this.subscriptionId = subscriptionId;
        this.gymId = gymId;
        this.amountMinor = amountMinor;
        this.method = method;
        this.reference = reference;
        this.receivedOn = receivedOn;
        this.recordedByUserId = recordedByUserId;
        this.idempotencyKey = idempotencyKey;
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public enum PaymentMethod {
        CASH, UPI, CARD, BANK_TRANSFER, CHEQUE
    }
}
