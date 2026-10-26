package com.limitbeyond.attendance.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** Per-location signing key behind the fixed printable QR check-in flow. */
@Entity
@Table(name = "location_qr_secrets")
public class LocationQrSecret {

    @Id
    private UUID id;

    @Column(name = "location_id", nullable = false)
    private UUID locationId;

    @Column(nullable = false)
    private byte[] secret;

    @Column(name = "rotation_seconds", nullable = false)
    private int rotationSeconds = 30;

    @Column(name = "rotated_at")
    private Instant rotatedAt;

    @Column(name = "is_active")
    private boolean active = true;

    protected LocationQrSecret() {
    }

    public LocationQrSecret(UUID locationId, byte[] secret) {
        this.id = UUID.randomUUID();
        this.locationId = locationId;
        this.secret = secret;
        this.rotatedAt = Instant.now();
    }

    public byte[] getSecret() {
        return secret;
    }

    public int getRotationSeconds() {
        return rotationSeconds;
    }
}
