package com.limitbeyond.attendance.internal;

import com.limitbeyond.attendance.domain.AttendanceStreak;
import com.limitbeyond.attendance.domain.CheckIn;
import com.limitbeyond.attendance.persistence.AttendanceStreakRepository;
import com.limitbeyond.attendance.persistence.CheckInRepository;
import com.limitbeyond.attendance.web.AttendanceDtos;
import com.limitbeyond.billing.api.MembershipFacade;
import com.limitbeyond.org.api.LocationFacade;
import com.limitbeyond.identity.api.RoleGrantFacade;
import com.limitbeyond.people.api.MemberFacade;
import com.limitbeyond.shared.error.DomainException;
import com.limitbeyond.shared.error.ErrorCode;
import com.limitbeyond.shared.jobs.JobQueueService;
import com.limitbeyond.shared.rls.AuthContext;
import com.limitbeyond.shared.rls.AuthContextHolder;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * FR-ATT-01/02/05/06/13. The single most latency-sensitive endpoint in the
 * platform (LB-ARCH-1.0 §4.4 traces this exact path) and the clearest
 * vindication of ADR-06's local-first design: everything below is invisible
 * to the member, who already saw their check-in confirmed on-device before
 * this method was ever called.
 *
 * <p>Order of operations matters and mirrors LB-ENG-1.0 §3.3's own worked
 * example precisely: idempotency check before any side effect, scope
 * authorisation before touching another module, membership validity before
 * the method-specific proof (QR signature or geofence distance), and the
 * derived work (streak recalculation) enqueued in the SAME transaction as
 * the insert rather than computed inline.
 */
@Service
public class AttendanceService {

    private static final Duration DUPLICATE_WINDOW = Duration.ofMinutes(5);
    public static final String JOB_RECALCULATE_STREAK = "RECALCULATE_STREAK";

    private final CheckInRepository checkInRepository;
    private final AttendanceStreakRepository attendanceStreakRepository;
    private final QrTokenService qrTokenService;
    private final LocationFacade locationFacade;
    private final MemberFacade memberFacade;
    private final MembershipFacade membershipFacade;
    private final JobQueueService jobQueueService;
    private final RoleGrantFacade roleGrantFacade;

    public AttendanceService(
            CheckInRepository checkInRepository,
            AttendanceStreakRepository attendanceStreakRepository,
            QrTokenService qrTokenService,
            LocationFacade locationFacade,
            MemberFacade memberFacade,
            MembershipFacade membershipFacade,
            JobQueueService jobQueueService,
            RoleGrantFacade roleGrantFacade) {
        this.checkInRepository = checkInRepository;
        this.attendanceStreakRepository = attendanceStreakRepository;
        this.qrTokenService = qrTokenService;
        this.locationFacade = locationFacade;
        this.memberFacade = memberFacade;
        this.membershipFacade = membershipFacade;
        this.jobQueueService = jobQueueService;
        this.roleGrantFacade = roleGrantFacade;
    }

    @Transactional
    public AttendanceDtos.CheckInResponse recordCheckIn(UUID locationId, String idempotencyKey,
            AttendanceDtos.CheckInRequest request) {
        AuthContext auth = AuthContextHolder.get();
        UUID userId = auth.userId();

        // 1. Idempotency FIRST, before any side effect (ENG-8.1 / FR-ATT-05).
        //    A replayed offline submission must return the ORIGINAL outcome,
        //    never create a second row.
        Optional<CheckIn> existing = checkInRepository.findByUserIdAndIdempotencyKey(userId, idempotencyKey);
        if (existing.isPresent()) {
            return toResponse(existing.get());
        }

        // 2. Scope, before touching any other module (NN-5). Out-of-scope
        //    reads as not-found, never forbidden — LB-API-1.0 §1.2.
        if (!auth.appliesAt(locationId)) {
            throw DomainException.notFound("Location");
        }

        // 3. FR-ATT-06 / FR-BIL-16: membership gate applies ONLY to accounts
        //    that ARE a member here at all. Staff (trainers, admins with no
        //    member_records row) train without a plan and skip this
        //    entirely — this facade call, not a role check, is what decides
        //    that, because a person can be staff at one gym and a member at
        //    another with no relationship between the two facts.
        UUID gymId = auth.gymId();
        var memberRecord = memberFacade.findByUserAndGym(userId, gymId);
        boolean grantedForCheckIn = memberRecord.map(member -> member.primaryLocationId().equals(locationId)).orElse(false)
                || roleGrantFacade.hasRoleAt(userId, gymId, locationId, "TRAINER", "GYM_OWNER", "LOCATION_ADMIN");
        if (!grantedForCheckIn) {
            throw DomainException.notFound("Location");
        }
        memberRecord.ifPresent(member -> {
            if (!membershipFacade.hasActiveMembership(member.memberRecordId())) {
                throw new DomainException(ErrorCode.MEMBERSHIP_NOT_ACTIVE,
                        "Your membership is not currently active.");
            }
        });

        // 4. FR-ATT-05: reject a second genuine check-in at the same location
        //    within a short window — distinct from idempotency-key dedup,
        //    which only catches a RETRY of the exact same request.
        Instant nowFloor = Instant.now().minus(DUPLICATE_WINDOW);
        if (checkInRepository.existsRecentCheckIn(userId, locationId, nowFloor)) {
            throw new DomainException(ErrorCode.DUPLICATE_CHECK_IN, "Already checked in recently.");
        }

        // 5. Method-specific proof.
        Double distanceM = null;
        boolean flagged = false;
        switch (request.method()) {
            case QR, GEOFENCE -> {
                if (request.qrToken() == null || !qrTokenService.verify(request.qrToken(), locationId)) {
                    if (request.method() == CheckIn.CheckInMethod.QR) {
                        throw new DomainException(ErrorCode.VALIDATION_FAILED,
                                "That QR code is invalid or belongs to another location.");
                    }
                }
                if (request.latitude() == null || request.longitude() == null) {
                    throw new DomainException(ErrorCode.VALIDATION_FAILED,
                            "Location coordinates are required for check-in.");
                }
                distanceM = locationFacade.distanceMeters(locationId, request.latitude(), request.longitude());
                int radius = locationFacade.checkinRadiusMeters(locationId);
                if (distanceM > radius) {
                    throw new DomainException(ErrorCode.OUTSIDE_GEOFENCE,
                            "You do not appear to be at this location.");
                }
                // FR-ATT-11: a wildly imprecise GPS reading makes a passing
                // distance meaningless — flagged for admin review, not
                // rejected outright (the whole point of "flag, don't block").
                if (request.accuracyM() != null && request.accuracyM() > radius) {
                    flagged = true;
                }
            }
            case MANUAL -> throw new DomainException(ErrorCode.VALIDATION_FAILED,
                    "Manual check-in is recorded by staff on the member's behalf, not self-submitted.");
        }

        // 6. FR-ATT-07: preserve the original timestamp from the offline
        //    outbox rather than substituting the moment this request happened
        //    to reach the server.
        Instant occurredAt = request.deferred() && request.occurredAt() != null
                ? request.occurredAt()
                : Instant.now();

        CheckIn checkIn = new CheckIn(gymId, locationId, userId, occurredAt, request.method(),
                request.purpose(), null, request.deferred(), distanceM, flagged, idempotencyKey);
        checkIn = checkInRepository.save(checkIn);

        // 7. ADR-09: enqueued in the SAME transaction as the insert, so a
        //    rollback here removes the job too — no orphaned recalculation
        //    for a check-in that never actually happened.
        jobQueueService.enqueue(JOB_RECALCULATE_STREAK, Map.of("userId", userId, "gymId", gymId));

        return toResponse(checkIn);
    }

    /** Only staff at this location may fetch its fixed printable code. A scan
     *  still requires an in-range geofence proof, so possession of the token
     *  alone cannot record attendance. */
    @Transactional
    public AttendanceDtos.QrTokenResponse issueQrToken(UUID locationId) {
        AuthContext auth = AuthContextHolder.get();
        if (!auth.isAllowed(locationId, "GYM_OWNER", "LOCATION_ADMIN", "TRAINER")) {
            throw DomainException.forbidden("display the check-in code for this location");
        }
        if (auth.gymId() == null || !locationFacade.existsInGym(locationId, auth.gymId())) {
            throw DomainException.notFound("Location");
        }
        String token = qrTokenService.issue(locationId);
        return new AttendanceDtos.QrTokenResponse(token, true);
    }

    /** The caller's own history — CheckInRepository's query was already
     *  written and used nowhere; this is the first read path for it. */
    @Transactional(readOnly = true)
    public java.util.List<AttendanceDtos.CheckInHistoryEntry> history() {
        UUID userId = AuthContextHolder.get().userId();
        return checkInRepository.findByUserIdOrderByOccurredAtDesc(userId).stream()
                .map(c -> new AttendanceDtos.CheckInHistoryEntry(
                        c.getId(), c.getLocationId(), c.getMethod().name(), c.getPurpose().name(),
                        c.getOccurredAt(), c.getDistanceM(), c.isDeferred(), c.isFlagged()))
                .toList();
    }

    /** Scoped to the caller's currently-active gym (AuthContext.gymId), same
     *  as everything else here — a streak is per gym, not global across
     *  every gym someone might belong to. */
    @Transactional(readOnly = true)
    public AttendanceDtos.StreakResponse currentStreak() {
        AuthContext auth = AuthContextHolder.get();
        return attendanceStreakRepository.findByUserIdAndGymId(auth.userId(), auth.gymId())
                .map(s -> new AttendanceDtos.StreakResponse(s.getCurrentStreak(), s.getLongestStreak(), s.getLastCheckInOn()))
                .orElse(new AttendanceDtos.StreakResponse(0, 0, null));
    }

    private AttendanceDtos.CheckInResponse toResponse(CheckIn checkIn) {
        // The streak figure here is the value BEFORE this check-in's own
        // recalculation job has run — recomputation happens asynchronously,
        // off the request path (ADR-09), so a fresh (non-replayed) call
        // reports one check-in behind for a few hundred milliseconds. Honest
        // about that rather than fabricating an already-updated number: the
        // dashboard's own GET reads the authoritative, by-then-current value.
        int currentStreak = attendanceStreakRepository.findByUserIdAndGymId(checkIn.getUserId(), checkIn.getGymId())
                .map(AttendanceStreak::getCurrentStreak)
                .orElse(0);
        return new AttendanceDtos.CheckInResponse(checkIn.getId(), currentStreak, null, checkIn.isDeferred());
    }

    static LocalDate toLocalDate(Instant instant) {
        return instant.atZone(ZoneOffset.UTC).toLocalDate();
    }
}
