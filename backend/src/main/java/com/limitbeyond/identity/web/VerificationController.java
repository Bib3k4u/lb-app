package com.limitbeyond.identity.web;

import com.limitbeyond.identity.internal.VerificationService;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** LB-API-1.0 §7: FR-AUTH-08. */
@RestController
class VerificationController {

    private final VerificationService verificationService;

    VerificationController(VerificationService verificationService) {
        this.verificationService = verificationService;
    }

    @GetMapping("/api/v1/verifications/pending")
    List<RosterDtos.PersonSummary> pending() {
        return verificationService.pendingApprovals();
    }

    @PostMapping("/api/v1/verifications/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void decide(@PathVariable UUID userId, @RequestBody Decision decision) {
        if (decision.approved()) {
            verificationService.approve(userId, decision.planId());
        } else {
            verificationService.reject(userId, decision.reason());
        }
    }

    record Decision(@NotNull Boolean approved, String reason, UUID planId) {
    }
}
