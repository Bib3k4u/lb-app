package com.limitbeyond.engagement.persistence;
import com.limitbeyond.engagement.domain.Feedback;import java.util.List;import java.util.UUID;import org.springframework.data.jpa.repository.JpaRepository;
public interface FeedbackRepository extends JpaRepository<Feedback,UUID>{List<Feedback> findByAuthorUserIdOrderByCreatedAtDesc(UUID userId);List<Feedback> findByLocationIdOrderByCreatedAtDesc(UUID locationId);}
