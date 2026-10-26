package com.limitbeyond.insights.internal;

import com.limitbeyond.insights.web.InsightsDtos;
import com.limitbeyond.shared.error.DomainException;
import com.limitbeyond.shared.error.ErrorCode;
import com.limitbeyond.shared.rls.AuthContext;
import com.limitbeyond.shared.rls.AuthContextHolder;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InsightsService {
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Kolkata");
    private static final int MAX_RANGE_DAYS = 366;
    private static final int DEFAULT_RECENT_LIMIT = 20;
    private static final int MAX_LIMIT = 200;

    private final InsightsRepository repository;

    public InsightsService(InsightsRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public InsightsDtos.Dashboard dashboard(UUID locationId, LocalDate from, LocalDate to, Integer recentLimit) {
        Window window = authorize(locationId, from, to);
        int limit = limit(recentLimit == null ? DEFAULT_RECENT_LIMIT : recentLimit);
        long totalMembers = repository.countMembers(window.gymId(), locationId);
        long activeMembers = repository.countActiveMembers(window.gymId(), locationId);
        return new InsightsDtos.Dashboard(
                new InsightsDtos.DateRange(window.from(), window.to().minusDays(1)),
                new InsightsDtos.Summary(totalMembers, activeMembers,
                        repository.countInactiveMembers(window.gymId(), locationId),
                        repository.countExpiringMemberships(window.gymId(), locationId, LocalDate.now(BUSINESS_ZONE), LocalDate.now(BUSINESS_ZONE).plusDays(30)),
                        repository.countTrainers(window.gymId(), locationId),
                        repository.countCheckIns(window.gymId(), locationId, window.fromAt(), window.toAt()),
                        repository.countUniqueMembersCheckedIn(window.gymId(), locationId, window.fromAt(), window.toAt()),
                        repository.countCompletedWorkouts(window.gymId(), locationId, window.fromAt(), window.toAt()),
                        totalMembers == 0 ? 0 : (double) activeMembers / totalMembers),
                repository.dailyActivity(window.gymId(), locationId, window.fromAt(), window.toAt()),
                repository.recentCheckIns(window.gymId(), locationId, window.fromAt(), window.toAt(), limit),
                repository.trainers(window.gymId(), locationId, window.fromAt(), window.toAt()));
    }

    @Transactional(readOnly = true)
    public List<InsightsDtos.MemberActivity> members(UUID locationId, LocalDate from, LocalDate to, String search, Integer requestedLimit) {
        Window window = authorize(locationId, from, to);
        return repository.members(window.gymId(), locationId, window.fromAt(), window.toAt(), search, limit(requestedLimit == null ? MAX_LIMIT : requestedLimit));
    }

    @Transactional(readOnly = true)
    public InsightsDtos.MemberPerformance memberPerformance(UUID userId, UUID locationId, LocalDate from, LocalDate to) {
        Window authorized = authorize(locationId, from, to);
        // The member query is deliberately constrained to the active gym. RLS
        // is a second line, not a substitute for this explicit tenant check.
        try {
            return repository.performance(authorized.gymId(), locationId, userId, authorized.fromAt(), authorized.toAt());
        } catch (org.springframework.dao.EmptyResultDataAccessException ex) {
            throw DomainException.notFound("Member");
        }
    }

    @Transactional(readOnly = true)
    public List<InsightsDtos.RecentCheckIn> recentCheckIns(UUID locationId, LocalDate from, LocalDate to, Integer requestedLimit) {
        Window window = authorize(locationId, from, to);
        return repository.recentCheckIns(window.gymId(), locationId, window.fromAt(), window.toAt(), limit(requestedLimit == null ? DEFAULT_RECENT_LIMIT : requestedLimit));
    }

    @Transactional(readOnly = true)
    public List<InsightsDtos.TrainerActivity> trainerActivity(UUID locationId, LocalDate from, LocalDate to) {
        Window window = authorize(locationId, from, to);
        return repository.trainers(window.gymId(), locationId, window.fromAt(), window.toAt());
    }

    @Transactional(readOnly = true)
    public List<InsightsDtos.TrainerDailyActivity> trainerDailyActivity(UUID locationId, LocalDate from, LocalDate to) {
        Window window = authorize(locationId, from, to);
        return repository.trainerDailyActivity(window.gymId(), locationId, window.fromAt(), window.toAt());
    }

    private Window authorize(UUID locationId, LocalDate from, LocalDate to) {
        AuthContext caller = requireAdmin();
        Window window = window(from, to);
        // Platform operators have a separate platform dashboard. Keeping
        // them out of this gym-scoped reporting surface prevents a null gym
        // context from becoming an accidental all-tenants analytics query.
        if (caller.superAdmin()) throw DomainException.forbidden("view the gym dashboard");
        if (caller.gymId() == null) throw DomainException.forbidden("view the gym dashboard");
        if (locationId != null && !caller.isAllowed(locationId, "GYM_OWNER", "LOCATION_ADMIN")) {
            throw DomainException.notFound("Location");
        }
        return new Window(caller.gymId(), window.from(), window.to(), window.fromAt(), window.toAt());
    }

    private AuthContext requireAdmin() {
        AuthContext caller = AuthContextHolder.get();
        if (!caller.isAdmin()) throw DomainException.forbidden("view the gym dashboard");
        return caller;
    }

    private Window window(LocalDate from, LocalDate to) {
        LocalDate end = to == null ? LocalDate.now(BUSINESS_ZONE).plusDays(1) : to.plusDays(1);
        LocalDate start = from == null ? end.minusDays(30) : from;
        if (start.isAfter(end.minusDays(1)) || start.plusDays(MAX_RANGE_DAYS).isBefore(end)) {
            throw new DomainException(ErrorCode.VALIDATION_FAILED, "The dashboard date range must be between 1 and 366 days.");
        }
        Instant startAt = start.atStartOfDay(BUSINESS_ZONE).toInstant();
        Instant endAt = end.atStartOfDay(BUSINESS_ZONE).toInstant();
        return new Window(null, start, end, Timestamp.from(startAt), Timestamp.from(endAt));
    }

    private int limit(int value) {
        if (value < 1 || value > MAX_LIMIT) throw new DomainException(ErrorCode.VALIDATION_FAILED, "Limit must be between 1 and 200.");
        return value;
    }

    private record Window(UUID gymId, LocalDate from, LocalDate to, Timestamp fromAt, Timestamp toAt) {
    }
}
