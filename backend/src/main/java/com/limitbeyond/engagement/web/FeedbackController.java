package com.limitbeyond.engagement.web;
import com.limitbeyond.engagement.internal.FeedbackService;import jakarta.validation.Valid;import java.util.*;import org.springframework.web.bind.annotation.*;
@RestController
class FeedbackController{private final FeedbackService service;FeedbackController(FeedbackService service){this.service=service;}
 @PostMapping("/api/v1/feedback")FeedbackDtos.FeedbackView create(@Valid @RequestBody FeedbackDtos.CreateRequest r){return service.create(r);}
 @GetMapping("/api/v1/me/feedback")List<FeedbackDtos.FeedbackView> mine(){return service.mine();}
 @GetMapping("/api/v1/feedback/{id}")FeedbackDtos.FeedbackView one(@PathVariable UUID id){return service.one(id);}
 @GetMapping("/api/v1/locations/{locationId}/feedback")List<FeedbackDtos.FeedbackView> queue(@PathVariable UUID locationId){return service.queue(locationId);}
 @PatchMapping("/api/v1/feedback/{id}")FeedbackDtos.FeedbackView update(@PathVariable UUID id,@Valid @RequestBody FeedbackDtos.UpdateRequest r){return service.update(id,r);}
 @DeleteMapping("/api/v1/feedback/{id}")void delete(@PathVariable UUID id){service.delete(id);}
 @PostMapping("/api/v1/feedback/{id}/responses")FeedbackDtos.FeedbackView respond(@PathVariable UUID id,@Valid @RequestBody FeedbackDtos.RespondRequest r){return service.respond(id,r);}
 @PatchMapping("/api/v1/feedback/{id}/responses/{responseId}")FeedbackDtos.FeedbackView updateResponse(@PathVariable UUID id,@PathVariable UUID responseId,@Valid @RequestBody FeedbackDtos.RespondRequest r){return service.updateResponse(id,responseId,r);}
 @DeleteMapping("/api/v1/feedback/{id}/responses/{responseId}")FeedbackDtos.FeedbackView deleteResponse(@PathVariable UUID id,@PathVariable UUID responseId){return service.deleteResponse(id,responseId);}
 @PostMapping("/api/v1/feedback/{id}/resolve")FeedbackDtos.FeedbackView resolve(@PathVariable UUID id){return service.setResolved(id,true);}
 @PostMapping("/api/v1/feedback/{id}/reopen")FeedbackDtos.FeedbackView reopen(@PathVariable UUID id){return service.setResolved(id,false);}
}
