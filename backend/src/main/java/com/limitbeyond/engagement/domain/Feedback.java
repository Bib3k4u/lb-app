package com.limitbeyond.engagement.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity @Table(name="feedback")
public class Feedback {
 @Id private UUID id;
 @Column(name="gym_id",nullable=false) private UUID gymId;
 @Column(name="location_id",nullable=false) private UUID locationId;
 @Column(name="author_user_id",nullable=false) private UUID authorUserId;
 @Column(nullable=false) private String title;
 @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.NAMED_ENUM) @Column(nullable=false,columnDefinition="feedback_category") private Category category;
 @Column(nullable=false) private String body;
 @Column(nullable=false) private String state;
 @Column(name="is_anonymous",nullable=false) private boolean anonymous;
 @Column(name="created_at",nullable=false) private Instant createdAt;
 @Column(name="updated_at",nullable=false) private Instant updatedAt;
 @OneToMany(mappedBy="feedback",cascade=CascadeType.ALL,orphanRemoval=true,fetch=FetchType.EAGER) @OrderBy("createdAt ASC") private List<FeedbackResponse> responses=new ArrayList<>();
 protected Feedback(){}
 public Feedback(UUID gymId,UUID locationId,UUID authorUserId,String title,Category category,String body,boolean anonymous){this.id=UUID.randomUUID();this.gymId=gymId;this.locationId=locationId;this.authorUserId=authorUserId;this.title=title.trim();this.category=category;this.body=body.trim();this.state="OPEN";this.anonymous=anonymous;this.createdAt=Instant.now();this.updatedAt=createdAt;}
 public void update(String title,Category category,String body,boolean anonymous){this.title=title.trim();this.category=category;this.body=body.trim();this.anonymous=anonymous;this.updatedAt=Instant.now();}
 public void addResponse(UUID userId,String body){responses.add(new FeedbackResponse(this,userId,body));state="IN_REVIEW";updatedAt=Instant.now();}
 public FeedbackResponse response(UUID responseId){return responses.stream().filter(r->r.getId().equals(responseId)).findFirst().orElse(null);}
 public void removeResponse(UUID responseId){responses.removeIf(r->r.getId().equals(responseId));updatedAt=Instant.now();}
 public void resolve(){state="RESOLVED";updatedAt=Instant.now();}
 public void reopen(){state="OPEN";updatedAt=Instant.now();}
 public UUID getId(){return id;}public UUID getGymId(){return gymId;}public UUID getLocationId(){return locationId;}public UUID getAuthorUserId(){return authorUserId;}public String getTitle(){return title;}public Category getCategory(){return category;}public String getBody(){return body;}public String getState(){return state;}public boolean isAnonymous(){return anonymous;}public Instant getCreatedAt(){return createdAt;}public Instant getUpdatedAt(){return updatedAt;}public List<FeedbackResponse> getResponses(){return List.copyOf(responses);}
 public enum Category { FACILITY,EQUIPMENT,TRAINER,CLEANLINESS,BILLING,APPLICATION,OTHER }
}
