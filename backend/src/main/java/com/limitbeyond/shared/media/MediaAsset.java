package com.limitbeyond.shared.media;

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

/**
 * NN-4's enforcement point: there is no {@code url} column here or anywhere
 * else in the schema. Every reference is this row's id; every URL is built
 * at read time from {@link #publicId} plus {@link #sensitivity} (LB-ENG-1.0 §13).
 */
@Entity
@Table(name = "media_assets")
public class MediaAsset {

    @Id
    private UUID id;

    private UUID gymId; // null = platform-wide asset

    @Column(name = "public_id", nullable = false, unique = true)
    private String publicId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "media_sensitivity")
    private Sensitivity sensitivity;

    @Column(name = "delivery_type", nullable = false)
    private String deliveryType;

    @Column(name = "content_type", nullable = false)
    private String contentType;

    private Long bytes;
    private Integer width;
    private Integer height;

    @Column(name = "uploaded_by_user_id")
    private UUID uploadedByUserId;

    @Column(name = "created_at")
    private Instant createdAt;

    protected MediaAsset() {
    }

    public MediaAsset(UUID gymId, String publicId, Sensitivity sensitivity, String contentType,
            Long bytes, Integer width, Integer height, UUID uploadedByUserId) {
        // NN-3, enforced in the constructor rather than left to caller
        // discipline: the delivery type follows DIRECTLY from sensitivity —
        // there is no path that lets a SENSITIVE asset end up with the
        // public 'upload' delivery type, because nothing here accepts one as
        // an independent argument.
        this.id = UUID.randomUUID();
        this.gymId = gymId;
        this.publicId = publicId;
        this.sensitivity = sensitivity;
        this.deliveryType = sensitivity == Sensitivity.SENSITIVE ? "authenticated" : "upload";
        this.contentType = contentType;
        this.bytes = bytes;
        this.width = width;
        this.height = height;
        this.uploadedByUserId = uploadedByUserId;
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public String getPublicId() {
        return publicId;
    }

    public Sensitivity getSensitivity() {
        return sensitivity;
    }

    public String getDeliveryType() {
        return deliveryType;
    }

    public enum Sensitivity {
        PUBLIC, SENSITIVE
    }
}
