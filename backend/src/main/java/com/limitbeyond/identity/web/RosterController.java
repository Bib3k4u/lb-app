package com.limitbeyond.identity.web;

import com.limitbeyond.identity.internal.RosterService;
import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** "Who's at my gym" for an admin — see RosterService's own Javadoc. */
@RestController
class RosterController {

    private final RosterService rosterService;

    RosterController(RosterService rosterService) {
        this.rosterService = rosterService;
    }

    @GetMapping("/api/v1/roster")
    List<RosterDtos.PersonSummary> roster() {
        return rosterService.activeRoster();
    }

    @PostMapping("/api/v1/roster/{userId}/deactivation")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deactivate(@PathVariable UUID userId, @Valid @RequestBody AccountActionRequest request) {
        rosterService.deactivate(userId, request.role());
    }

    @PostMapping("/api/v1/roster/{userId}/reactivation")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void reactivate(@PathVariable UUID userId, @Valid @RequestBody AccountActionRequest request) {
        rosterService.reactivate(userId, request.role(), request.planId());
    }

    record AccountActionRequest(@NotBlank String role, UUID planId) {
    }
}
