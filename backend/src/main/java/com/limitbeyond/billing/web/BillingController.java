package com.limitbeyond.billing.web;

import com.limitbeyond.billing.internal.BillingService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** LB-API-1.0 §8, the minimal slice — see BillingService's own scope note. */
@RestController
class BillingController {

    private final BillingService billingService;

    BillingController(BillingService billingService) {
        this.billingService = billingService;
    }

    @GetMapping("/api/v1/plans")
    List<BillingDtos.PlanSummary> listPlans() {
        return billingService.listPlans();
    }

    @GetMapping("/api/v1/me/membership")
    Optional<BillingDtos.MembershipView> myMembership() {
        return billingService.myMembership();
    }

    @PostMapping("/api/v1/plans")
    @ResponseStatus(HttpStatus.CREATED)
    UUID createPlan(@jakarta.validation.Valid @RequestBody CreatePlanRequest request) {
        return billingService.createPlan(request.name(), request.durationMonths(), request.priceMinor());
    }

    @PutMapping("/api/v1/plans/{planId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void updatePlan(@PathVariable UUID planId, @jakarta.validation.Valid @RequestBody CreatePlanRequest request) {
        billingService.updatePlan(planId, request.name(), request.durationMonths(), request.priceMinor());
    }

    @DeleteMapping("/api/v1/plans/{planId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deletePlan(@PathVariable UUID planId) {
        billingService.deletePlan(planId);
    }

    @PostMapping("/api/v1/members/{memberRecordId}/memberships")
    @ResponseStatus(HttpStatus.CREATED)
    UUID sellMembership(@PathVariable UUID memberRecordId, @jakarta.validation.Valid @RequestBody SellMembershipRequest request) {
        return billingService.sellMembership(memberRecordId, request.planId(), request.startsOn());
    }

    record CreatePlanRequest(@NotBlank String name, @Positive int durationMonths, @Positive long priceMinor) {
    }

    record SellMembershipRequest(@NotNull UUID planId, @NotNull LocalDate startsOn) {
    }
}
