package com.limitbeyond.platform.web;

import com.limitbeyond.platform.internal.PlatformService;
import com.limitbeyond.shared.error.DomainException;
import com.limitbeyond.shared.error.ErrorCode;
import com.limitbeyond.shared.rls.AuthContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** See PlatformService.defaultOffering's Javadoc — one offering, not a
 *  catalogue, until offering management gets its own pass. */
@RestController
@RequestMapping("/api/v1/platform/subscription-offerings")
class SubscriptionOfferingController {

    private final PlatformService platformService;

    SubscriptionOfferingController(PlatformService platformService) {
        this.platformService = platformService;
    }

    @GetMapping("/default")
    PlatformDtos.OfferingSummary defaultOffering() {
        if (!AuthContextHolder.get().superAdmin()) {
            throw new DomainException(ErrorCode.FORBIDDEN, "Only the platform operator may do this.");
        }
        return platformService.defaultOffering();
    }
}
