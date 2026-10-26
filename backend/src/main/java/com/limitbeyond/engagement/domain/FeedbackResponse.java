package com.limitbeyond.engagement.domain;
import jakarta.persistence.*;import java.time.Instant;import java.util.UUID;
@Entity @Table(name="feedback_responses")
public class FeedbackResponse {
 @Id private UUID id;@ManyToOne(fetch=FetchType.LAZY,optional=false)@JoinColumn(name="feedback_id")private Feedback feedback;
 @Column(name="author_user_id",nullable=false)private UUID authorUserId;@Column(nullable=false)private String body;@Column(name="created_at",nullable=false)private Instant createdAt;@Column(name="updated_at",nullable=false)private Instant updatedAt;
 protected FeedbackResponse(){} FeedbackResponse(Feedback feedback,UUID authorUserId,String body){this.id=UUID.randomUUID();this.feedback=feedback;this.authorUserId=authorUserId;this.body=body.trim();this.createdAt=Instant.now();this.updatedAt=createdAt;}
 public void update(String body){this.body=body.trim();this.updatedAt=Instant.now();}
 public UUID getId(){return id;}public UUID getAuthorUserId(){return authorUserId;}public String getBody(){return body;}public Instant getCreatedAt(){return createdAt;}public Instant getUpdatedAt(){return updatedAt;}
}
