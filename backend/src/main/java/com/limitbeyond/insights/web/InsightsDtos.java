package com.limitbeyond.insights.web;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Read models for the admin dashboard. They deliberately contain no JPA
 * entities, so the future web console can consume a stable reporting API. */
public final class InsightsDtos {
    private InsightsDtos() {
    }

    public record Dashboard(
            DateRange range,
            Summary summary,
            List<DailyActivity> dailyActivity,
            List<RecentCheckIn> recentCheckIns,
            List<TrainerActivity> trainers) {
    }

    public record DateRange(LocalDate from, LocalDate to) {
    }

    public record Summary(
            long totalMembers,
            long activeMembers,
            long inactiveMembers,
            long membershipsExpiringSoon,
            long totalTrainers,
            long checkIns,
            long uniqueMembersCheckedIn,
            long workoutsCompleted,
            double activeMemberRate) {
    }

    public record DailyActivity(
            LocalDate day,
            long memberCheckIns,
            long trainerCheckIns,
            long totalCheckIns,
            long uniqueMembers,
            long completedWorkouts) {
    }

    public record RecentCheckIn(
            UUID id,
            UUID userId,
            String memberName,
            String role,
            UUID locationId,
            String locationName,
            Instant occurredAt,
            String method,
            String purpose,
            Double distanceM,
            boolean flagged) {
    }

    public record TrainerActivity(
            UUID userId,
            String trainerName,
            String accountState,
            long assignedMembers,
            long checkIns,
            long completedWorkouts,
            Instant lastSeenAt) {
    }

    public record TrainerDailyActivity(
            LocalDate day,
            UUID trainerUserId,
            String trainerName,
            long checkIns,
            long completedWorkouts) {
    }

    public record MemberActivity(
            UUID userId,
            UUID memberRecordId,
            String memberName,
            String accountState,
            String membershipState,
            LocalDate membershipExpiresOn,
            boolean membershipCurrentlyActive,
            UUID primaryLocationId,
            long checkIns,
            long completedWorkouts,
            Instant lastCheckInAt,
            Instant lastWorkoutAt,
            Trainer trainer) {
    }

    public record Trainer(UUID userId, String name, UUID locationId) {
    }

    public record MemberPerformance(
            UUID userId,
            String memberName,
            long completedWorkouts,
            long totalWorkoutMinutes,
            long completedSets,
            BigDecimal totalVolumeKg,
            List<MetricPoint> metrics,
            List<WorkoutPoint> workouts) {
    }

    public record MetricPoint(String metricType, LocalDate recordedOn, BigDecimal value, String unit) {
    }

    public record WorkoutPoint(
            UUID id, String title, Instant performedAt, int durationMinutes, boolean completed, int completedSets) {
    }
}
