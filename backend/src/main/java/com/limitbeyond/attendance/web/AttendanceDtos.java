package com.limitbeyond.attendance.web;

import com.limitbeyond.attendance.domain.CheckIn;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;

public final class AttendanceDtos {

    private AttendanceDtos() {
    }

    public record CheckInRequest(
            @NotNull CheckIn.CheckInMethod method,
            @NotNull CheckIn.CheckInPurpose purpose,
            String qrToken, // required when method = QR
            Double latitude, // required when method = GEOFENCE
            Double longitude,
            Double accuracyM,
            Instant occurredAt, // preserved from the offline outbox — FR-ATT-07
            boolean deferred) {
    }

    public record CheckInResponse(UUID checkInId, int streakDays, Double distanceM, boolean deferred) {
    }

    public record QrTokenResponse(String token, boolean reusable) {
    }

    public record CheckInHistoryEntry(
            UUID id, UUID locationId, String method, String purpose, Instant occurredAt,
            Double distanceM, boolean deferred, boolean flagged) {
    }

    public record StreakResponse(int currentStreak, int longestStreak, java.time.LocalDate lastCheckInOn) {
    }
}
