package com.limitbeyond.identity.web;

import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;

public final class TrainerAssignmentDtos {
    private TrainerAssignmentDtos() {}

    public record AssignRequest(@NotNull UUID trainerUserId) {}
    public record TrainerSummary(UUID userId, String firstName, String lastName, String phoneE164, String email) {}
    public record AssignmentView(UUID trainerUserId, String firstName, String lastName, UUID locationId, Instant assignedAt) {}
}
