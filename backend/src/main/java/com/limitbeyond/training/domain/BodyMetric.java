package com.limitbeyond.training.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity @Table(name = "body_metrics")
public class BodyMetric {
    @Id private UUID id;
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(name = "gym_id") private UUID gymId;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "metric_type", nullable = false, columnDefinition = "metric_type") private MetricType metricType;
    @Column(name = "recorded_on", nullable = false) private LocalDate recordedOn;
    @Column(nullable = false) private BigDecimal value;
    @Column(nullable = false) private String unit;
    @Column(name = "recorded_by_user_id", nullable = false) private UUID recordedByUserId;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    protected BodyMetric() {}
    public BodyMetric(UUID userId, UUID gymId, MetricType metricType, LocalDate recordedOn, BigDecimal value, String unit, UUID recordedByUserId) {
        this.id=UUID.randomUUID(); this.userId=userId; this.gymId=gymId; this.metricType=metricType; this.recordedOn=recordedOn;
        this.value=value; this.unit=unit; this.recordedByUserId=recordedByUserId; this.createdAt=Instant.now();
    }
    public void updateMeasurement(BigDecimal value, String unit, UUID recordedByUserId) {
        this.value = value;
        this.unit = unit;
        this.recordedByUserId = recordedByUserId;
    }
    public UUID getId(){return id;} public MetricType getMetricType(){return metricType;} public LocalDate getRecordedOn(){return recordedOn;}
    public BigDecimal getValue(){return value;} public String getUnit(){return unit;}
    public enum MetricType { WEIGHT_KG, BODY_FAT_PCT, CHEST_CM, WAIST_CM, HIP_CM, ARM_CM, THIGH_CM, NECK_CM }
}
