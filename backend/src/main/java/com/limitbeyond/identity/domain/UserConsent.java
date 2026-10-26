package com.limitbeyond.identity.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** NFR-PRV-06: MARKETING/WHATSAPP held separately from TERMS/PRIVACY. Never deleted. */
@Entity
@Table(name = "user_consents")
public class UserConsent {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "consent_type", nullable = false, columnDefinition = "consent_type")
    private ConsentType consentType;

    @Column(nullable = false)
    private String version;

    @Column(name = "granted_at")
    private Instant grantedAt;

    @Column(name = "withdrawn_at")
    private Instant withdrawnAt;

    protected UserConsent() {
    }

    public UserConsent(UUID userId, ConsentType consentType, String version) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.consentType = consentType;
        this.version = version;
        this.grantedAt = Instant.now();
    }

    public UUID getUserId() {
        return userId;
    }

    public ConsentType getConsentType() {
        return consentType;
    }

    public enum ConsentType {
        TERMS, PRIVACY, MARKETING, WHATSAPP
    }
}
