package com.limitbeyond.insights.web;

import com.limitbeyond.insights.internal.InsightsService;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Admin reporting API for the future web console. All endpoints are
 * read-only and use the caller's active gym from AuthContext. */
@RestController
@RequestMapping("/api/v1/admin/dashboard")
class InsightsController {
    private final InsightsService service;

    InsightsController(InsightsService service) {
        this.service = service;
    }

    @GetMapping
    InsightsDtos.Dashboard dashboard(@RequestParam(required = false) UUID locationId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Integer recentLimit) {
        return service.dashboard(locationId, from, to, recentLimit);
    }

    @GetMapping("/members")
    List<InsightsDtos.MemberActivity> members(@RequestParam(required = false) UUID locationId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String search, @RequestParam(required = false) Integer limit) {
        return service.members(locationId, from, to, search, limit);
    }

    @GetMapping("/members/{userId}/performance")
    InsightsDtos.MemberPerformance memberPerformance(@PathVariable UUID userId,
            @RequestParam(required = false) UUID locationId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.memberPerformance(userId, locationId, from, to);
    }

    @GetMapping("/check-ins/recent")
    List<InsightsDtos.RecentCheckIn> recentCheckIns(@RequestParam(required = false) UUID locationId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Integer limit) {
        return service.recentCheckIns(locationId, from, to, limit);
    }

    @GetMapping("/trainers")
    List<InsightsDtos.TrainerActivity> trainers(@RequestParam(required = false) UUID locationId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.trainerActivity(locationId, from, to);
    }

    @GetMapping("/trainers/daily")
    List<InsightsDtos.TrainerDailyActivity> trainersDaily(@RequestParam(required = false) UUID locationId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.trainerDailyActivity(locationId, from, to);
    }
}
