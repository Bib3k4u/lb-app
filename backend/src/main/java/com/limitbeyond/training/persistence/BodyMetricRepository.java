package com.limitbeyond.training.persistence;
import com.limitbeyond.training.domain.BodyMetric;
import java.time.LocalDate; import java.util.List; import java.util.Optional; import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface BodyMetricRepository extends JpaRepository<BodyMetric, UUID> {
 List<BodyMetric> findByUserIdOrderByRecordedOnDesc(UUID userId);
 Optional<BodyMetric> findByUserIdAndMetricTypeAndRecordedOn(UUID userId,BodyMetric.MetricType metricType,LocalDate recordedOn);
}
