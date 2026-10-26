package com.limitbeyond.attendance.internal;

import com.limitbeyond.attendance.domain.AttendanceStreak;
import com.limitbeyond.attendance.domain.CheckIn;
import com.limitbeyond.attendance.persistence.AttendanceStreakRepository;
import com.limitbeyond.attendance.persistence.CheckInRepository;
import com.limitbeyond.shared.jobs.JobHandler;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * ADR-09's async half of check-in: recomputes a member's streak off the
 * request path, so the check-in response itself stays a single-digit-
 * millisecond write (LB-ARCH-1.0 §4.4). Runs under {@code JobWorker}'s
 * system-level ({@code superAdmin}) context, which is what lets it read and
 * write a streak row belonging to whichever gym the check-in occurred at,
 * regardless of which gym context originally triggered it.
 *
 * <p>Deliberately rebuilds the whole streak from the check-in history each
 * time rather than doing a cheaper incremental update in place — "always
 * safe to rebuild from check_ins" (LB-DATA-1.0 §7) is worth more here than
 * the extra query, because it means a bug in this handler can never leave a
 * streak permanently wrong; the next check-in's job self-corrects it.
 */
@Component
class RecalculateStreakJobHandler implements JobHandler {

    private final CheckInRepository checkInRepository;
    private final AttendanceStreakRepository attendanceStreakRepository;

    RecalculateStreakJobHandler(CheckInRepository checkInRepository, AttendanceStreakRepository attendanceStreakRepository) {
        this.checkInRepository = checkInRepository;
        this.attendanceStreakRepository = attendanceStreakRepository;
    }

    @Override
    public String jobType() {
        return AttendanceService.JOB_RECALCULATE_STREAK;
    }

    @Override
    @Transactional
    public void handle(Map<String, String> payload) {
        UUID userId = UUID.fromString(payload.get("userId"));
        UUID gymId = UUID.fromString(payload.get("gymId"));

        List<CheckIn> history = checkInRepository.findByUserIdOrderByOccurredAtDesc(userId);
        // Oldest first: recordCheckIn's day-over-day comparison only makes
        // sense walked forward in time.
        List<CheckIn> chronological = history.reversed();

        // Fetch-or-create so an existing row's identity (and therefore its
        // unique (user_id, gym_id) constraint slot) is reused — reset() then
        // clears its mutable fields so replaying the full history below acts
        // on a genuinely clean slate rather than compounding onto whatever
        // was there before.
        AttendanceStreak streak = attendanceStreakRepository.findByUserIdAndGymId(userId, gymId)
                .orElseGet(() -> new AttendanceStreak(userId, gymId));
        streak.reset();

        for (CheckIn checkIn : chronological) {
            if (!checkIn.getGymId().equals(gymId)) {
                continue; // a streak is per-gym; check-ins at another gym don't count here
            }
            streak.recordCheckIn(AttendanceService.toLocalDate(checkIn.getOccurredAt()));
        }

        attendanceStreakRepository.save(streak);
    }
}
