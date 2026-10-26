package com.limitbeyond.platform.web;

import com.limitbeyond.identity.api.RoleGrantFacade;
import com.limitbeyond.org.api.LocationFacade;
import com.limitbeyond.platform.internal.PlatformService;
import com.limitbeyond.shared.error.DomainException;
import com.limitbeyond.shared.error.ErrorCode;
import com.limitbeyond.shared.rls.AuthContext;
import com.limitbeyond.shared.rls.AuthContextHolder;
import com.limitbeyond.shared.security.ActionTokenService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Approve or reject a gym or branch from the Super Admin notification email.
 *
 * <p>Public by path (the person may not be signed in), but authorised by a
 * signed, expiring, single-purpose token that names the reviewer and the exact
 * target — see {@link ActionTokenService}. The reviewer must still hold
 * SUPER_ADMIN when the decision is made. The action runs as that reviewer, so
 * the usual domain rules, and the audit trail's "reviewed by", apply unchanged.
 */
@RestController
@RequestMapping("/api/v1/platform/email-actions")
class EmailActionController {

    private final ActionTokenService actionTokenService;
    private final PlatformService platformService;
    private final LocationFacade locationFacade;
    private final RoleGrantFacade roleGrantFacade;

    EmailActionController(ActionTokenService actionTokenService, PlatformService platformService,
            LocationFacade locationFacade, RoleGrantFacade roleGrantFacade) {
        this.actionTokenService = actionTokenService;
        this.platformService = platformService;
        this.locationFacade = locationFacade;
        this.roleGrantFacade = roleGrantFacade;
    }

    record DecisionRequest(@NotBlank String token, boolean approved, String reason) {
    }

    @PostMapping("/decide")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void decide(@Valid @RequestBody DecisionRequest request) {
        ActionTokenService.Action action = actionTokenService.verify(request.token());
        if (!request.approved() && (request.reason() == null || request.reason().isBlank())) {
            throw new DomainException(ErrorCode.VALIDATION_FAILED, "A rejection reason is required.");
        }

        AuthContext original = AuthContextHolder.get();
        AuthContextHolder.set(AuthContext.superAdmin(action.reviewerId()));
        try {
            if (!roleGrantFacade.isSuperAdmin(action.reviewerId())) {
                throw new DomainException(ErrorCode.FORBIDDEN, "This review link is no longer valid for your account.");
            }
            String reason = request.reason() == null ? null : request.reason().trim();
            switch (action.type()) {
                case ActionTokenService.GYM_REVIEW -> platformService.verify(action.targetId(), request.approved(), reason);
                case ActionTokenService.LOCATION_REVIEW -> locationFacade.reviewLocation(action.targetId(), request.approved(), reason);
                default -> throw new DomainException(ErrorCode.VALIDATION_FAILED, "This review link is not valid.");
            }
        } finally {
            AuthContextHolder.set(original);
        }
    }
}
