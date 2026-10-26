package com.limitbeyond.platform.web;

import com.limitbeyond.platform.internal.PlatformService;
import com.limitbeyond.shared.error.DomainException;
import com.limitbeyond.shared.error.ErrorCode;
import com.limitbeyond.shared.rls.AuthContextHolder;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** LB-API-1.0 §5, plus the self-serve registration endpoint FR-AUTH-04
 *  requires but the published API spec had not yet listed explicitly. */
@RestController
@RequestMapping("/api/v1/platform/gyms")
class PlatformController {

    private final PlatformService platformService;

    PlatformController(PlatformService platformService) {
        this.platformService = platformService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    UUID register(@Valid @RequestBody PlatformDtos.RegisterGymRequest request) {
        UUID registrantId = AuthContextHolder.get().userId();
        return platformService.registerGym(
                registrantId, request.slug(), request.legalName(), request.tradingName(), request.gstin(),
                request.location().toFacadeRecord());
    }

    @GetMapping("/pending")
    List<PlatformDtos.GymSummary> pending() {
        requireSuperAdmin();
        return platformService.pendingGyms();
    }

    @GetMapping
    List<PlatformDtos.GymSummary> all() {
        requireSuperAdmin();
        return platformService.allGyms();
    }

    @GetMapping("/revenue")
    PlatformDtos.RevenueSummary revenue() {
        requireSuperAdmin();
        return platformService.revenueSummary();
    }

    /** Any authenticated caller — including a brand-new, still
     *  PENDING_VERIFICATION account with no grants yet, which is exactly who
     *  this is for: choosing a gym to join before they hold any grant at
     *  all. See JwtAuthenticationFilter's RESTRICTED_STATE_ALLOWLIST. */
    @GetMapping("/directory")
    List<PlatformDtos.GymDirectoryEntry> directory() {
        return platformService.listLiveGyms();
    }

    @PostMapping("/{gymId}/verification")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void verify(@PathVariable UUID gymId, @Valid @RequestBody PlatformDtos.VerificationDecision decision) {
        requireSuperAdmin();
        platformService.verify(gymId, decision.approved(), decision.reason());
    }

    @PostMapping("/{gymId}/deactivation")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deactivate(@PathVariable UUID gymId, @Valid @RequestBody PlatformDtos.DeactivationRequest request) {
        requireSuperAdmin();
        platformService.deactivate(gymId, request.reason());
    }

    @PostMapping("/{gymId}/reactivation")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void reactivate(@PathVariable UUID gymId) {
        requireSuperAdmin();
        platformService.reactivate(gymId);
    }

    @DeleteMapping("/{gymId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void close(@PathVariable UUID gymId) {
        requireSuperAdmin();
        platformService.close(gymId);
    }

    @PostMapping("/{gymId}/subscription-payments")
    @ResponseStatus(HttpStatus.CREATED)
    UUID recordPayment(
            @PathVariable UUID gymId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody PlatformDtos.SubscriptionPaymentRequest request) {
        requireSuperAdmin();
        return platformService.recordSubscriptionPayment(
                gymId, request.offeringId(), request.amountMinor(), request.method(),
                request.reference(), request.receivedOn(), idempotencyKey);
    }

    /** Deliberately a hand check rather than a Spring Security expression:
     *  Super Admin is a whole-platform bypass with no location scope to
     *  express, and NN-5 asks that the check be the first thing a
     *  tenant-touching operation does — visible here, not buried in an
     *  annotation. */
    private void requireSuperAdmin() {
        if (!AuthContextHolder.get().superAdmin()) {
            throw new DomainException(ErrorCode.FORBIDDEN, "Only the platform operator may do this.");
        }
    }
}
