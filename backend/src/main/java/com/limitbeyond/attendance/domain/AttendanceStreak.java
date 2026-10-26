package com.limitbeyond.attendance.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** Derived — always safe to rebuild from check_ins. Recomputed off the
 *  request path by RecalculateStreakJobHandler (ADR-09). */
@Entity
@Table(name = "attendance_streaks")
public class AttendanceStreak {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "gym_id", nullable = false)
    private UUID gymId;

    @Column(name = "current_streak")
    private int currentStreak;

    @Column(name = "longest_streak")
    private int longestStreak;

    @Column(name = "last_check_in_on")
    private LocalDate lastCheckInOn;

    @Column(name = "updated_at")
    private Instant updatedAt;

    protected AttendanceStreak() {
    }

    public AttendanceStreak(UUID userId, UUID gymId) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.gymId = gymId;
        this.updatedAt = Instant.now();
    }

    /** Zeroes the mutable fields, keeping identity (id/userId/gymId) intact —
     *  what lets RecalculateStreakJobHandler replay the full check-in
     *  history from scratch and save() as an UPDATE rather than accidentally
     *  inserting a second row for the same (user, gym) pair. */
    public void reset() {
        this.currentStreak = 0;
        this.longestStreak = 0;
        this.lastCheckInOn = null;
    }

    /** Recomputes forward from a new check-in date, given the last known one. */
    public void recordCheckIn(LocalDate occurredOn) {
        if (lastCheckInOn != null) {
            if (lastCheckInOn.equals(occurredOn)) {
                return; // already counted today
            }
            if (lastCheckInOn.plusDays(1).equals(occurredOn)) {
                currentStreak++;
            } else {
                currentStreak = 1; // the streak broke
            }
        } else {
            currentStreak = 1;
        }
        longestStreak = Math.max(longestStreak, currentStreak);
        lastCheckInOn = occurredOn;
        updatedAt = Instant.now();
    }

    public int getCurrentStreak() {
        return currentStreak;
    }

    public int getLongestStreak() {
        return longestStreak;
    }

    public LocalDate getLastCheckInOn() {
        return lastCheckInOn;
    }
}
