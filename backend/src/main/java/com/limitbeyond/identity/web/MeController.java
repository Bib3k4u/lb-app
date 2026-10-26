package com.limitbeyond.identity.web;

import com.limitbeyond.identity.internal.AuthService;
import com.limitbeyond.shared.rls.AuthContextHolder;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * FR-AUTH-09's landing point: {@code GET /me} is the one endpoint a
 * PENDING_VERIFICATION account can always reach, alongside registration
 * itself. Also a convenient plain authenticated read for latency testing —
 * see test/TEST.md.
 */
@RestController
class MeController {

    private final AuthService authService;

    MeController(AuthService authService) {
        this.authService = authService;
    }

    @GetMapping("/api/v1/me")
    AuthDtos.MeResponse me() {
        return authService.me(AuthContextHolder.get().userId());
    }

    /** The onboarding-steps endpoint: one call per step, see
     *  CompleteProfileRequest's Javadoc. Reachable at PENDING_VERIFICATION
     *  the same as GET /me — it's the same path, and JwtAuthenticationFilter's
     *  allowlist matches by path, not method. */
    @PatchMapping("/api/v1/me")
    AuthDtos.MeResponse completeProfile(@Valid @RequestBody AuthDtos.CompleteProfileRequest request) {
        return authService.completeProfile(AuthContextHolder.get().userId(), request);
    }
}
