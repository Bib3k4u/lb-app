package com.limitbeyond.identity.web;

import com.limitbeyond.identity.internal.TrainerAssignmentService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
class TrainerAssignmentController {
    private final TrainerAssignmentService service;
    TrainerAssignmentController(TrainerAssignmentService service) { this.service = service; }

    @GetMapping("/api/v1/locations/{locationId}/trainers")
    List<TrainerAssignmentDtos.TrainerSummary> trainers(@PathVariable UUID locationId) { return service.trainersAt(locationId); }

    @PutMapping("/api/v1/members/{memberRecordId}/trainer")
    TrainerAssignmentDtos.AssignmentView assign(@PathVariable UUID memberRecordId, @Valid @RequestBody TrainerAssignmentDtos.AssignRequest request) {
        return service.assign(memberRecordId, request.trainerUserId());
    }

    @DeleteMapping("/api/v1/members/{memberRecordId}/trainer")
    ResponseEntity<Void> unassign(@PathVariable UUID memberRecordId) {
        service.unassign(memberRecordId);
        return ResponseEntity.noContent().build();
    }
}
