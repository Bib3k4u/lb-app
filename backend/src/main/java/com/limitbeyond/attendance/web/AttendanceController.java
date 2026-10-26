package com.limitbeyond.attendance.web;

import com.limitbeyond.attendance.internal.AttendanceService;
import com.limitbeyond.shared.error.DomainException;
import com.limitbeyond.shared.error.ErrorCode;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/** LB-API-1.0 §9. The flagship, perf-tested endpoint — see test/TEST.md. */
@RestController
class AttendanceController {

    private final AttendanceService attendanceService;

    AttendanceController(AttendanceService attendanceService) {
        this.attendanceService = attendanceService;
    }

    @GetMapping("/api/v1/me/check-ins")
    List<AttendanceDtos.CheckInHistoryEntry> history() {
        return attendanceService.history();
    }

    @GetMapping("/api/v1/me/streak")
    AttendanceDtos.StreakResponse streak() {
        return attendanceService.currentStreak();
    }

    @GetMapping("/api/v1/locations/{locationId}/qr-token")
    AttendanceDtos.QrTokenResponse qrToken(@PathVariable UUID locationId) {
        return attendanceService.issueQrToken(locationId);
    }

    @PostMapping("/api/v1/locations/{locationId}/check-ins")
    ResponseEntity<AttendanceDtos.CheckInResponse> checkIn(
            @PathVariable UUID locationId,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody AttendanceDtos.CheckInRequest request) {
        // LB-API-1.0 §2.7: required on every retryable write. Checked here,
        // not with a Bean Validation annotation, so the response carries the
        // specific IDEMPOTENCY_KEY_REQUIRED code rather than a generic 400.
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new DomainException(ErrorCode.IDEMPOTENCY_KEY_REQUIRED,
                    "An Idempotency-Key header is required for check-ins.");
        }

        AttendanceDtos.CheckInResponse response = attendanceService.recordCheckIn(locationId, idempotencyKey, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
