package com.limitbeyond.engagement.web;
import com.limitbeyond.engagement.domain.Feedback.Category;import jakarta.validation.constraints.*;import java.time.Instant;import java.util.List;import java.util.UUID;
public final class FeedbackDtos{private FeedbackDtos(){}
 public record CreateRequest(@NotNull UUID locationId,@NotBlank @Size(max=160)String title,@NotNull Category category,@NotBlank @Size(max=4000)String body,boolean anonymous){}
 public record UpdateRequest(@NotBlank @Size(max=160)String title,@NotNull Category category,@NotBlank @Size(max=4000)String body,boolean anonymous){}
 public record RespondRequest(@NotBlank @Size(max=4000)String body){}
 public record ResponseView(UUID id,String authorName,String body,Instant createdAt,Instant updatedAt,boolean ownedByCaller){}
 public record FeedbackView(UUID id,UUID locationId,String title,Category category,String body,String state,boolean anonymous,String authorName,Instant createdAt,Instant updatedAt,boolean ownedByCaller,List<ResponseView> responses){}
}
