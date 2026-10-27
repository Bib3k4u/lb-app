package com.limitbeyond.identity.web;

import com.limitbeyond.identity.internal.AuthService;
import com.limitbeyond.shared.rls.AuthContextHolder;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** LB-API-1.0 §4. No controller method contains logic beyond one service call
 *  and a status code — ENG's own convention, honoured here even though the
 *  service happens to return the response DTO directly (see AuthDtos). */
@RestController
@RequestMapping("/api/v1/auth")
class AuthController {

    private final AuthService authService;

    AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/otp/request")
    @ResponseStatus(HttpStatus.ACCEPTED)
    void requestOtp(@Valid @RequestBody AuthDtos.OtpRequestRequest request, HttpServletRequest httpRequest) {
        authService.requestOtp(request.identifier(), request.channel(), deviceFingerprint(httpRequest));
    }

    @PostMapping("/otp/verify")
    AuthDtos.TokenResponse verifyOtp(@Valid @RequestBody AuthDtos.OtpVerifyRequest request, HttpServletRequest httpRequest) {
        return authService.verifyOtp(request.identifier(), request.code(), request.firstName(), request.lastName(),
                deviceFingerprint(httpRequest));
    }

    /** Email + password — see AuthDtos.LoginRequest's Javadoc for who this is
     *  for and why it exists alongside OTP rather than instead of it. */
    @PostMapping("/login")
    AuthDtos.TokenResponse login(@Valid @RequestBody AuthDtos.LoginRequest request, HttpServletRequest httpRequest) {
        return authService.login(request.email(), request.password(), deviceFingerprint(httpRequest));
    }

    /** Google sign-in for accounts that already exist — see
     *  AuthService.googleSignIn for why it never creates one. */
    @PostMapping("/google")
    AuthDtos.TokenResponse googleSignIn(@Valid @RequestBody AuthDtos.GoogleLoginRequest request, HttpServletRequest httpRequest) {
        return authService.googleSignIn(request.idToken(), deviceFingerprint(httpRequest));
    }

    /** Google-first registration for a gym owner: verifies the token, creates
     *  the account if it is new (or signs in the existing one), and returns
     *  tokens so the client can go straight on to the gym-details step. */
    @PostMapping("/google/register")
    AuthDtos.TokenResponse googleRegister(@Valid @RequestBody AuthDtos.GoogleLoginRequest request, HttpServletRequest httpRequest) {
        return authService.googleRegister(request.idToken(), deviceFingerprint(httpRequest), "app".equals(request.client()));
    }

    @PostMapping("/admin/register")
    @ResponseStatus(HttpStatus.CREATED)
    void registerAdmin(@Valid @RequestBody AuthDtos.AdminRegistrationRequest request, HttpServletRequest httpRequest) {
        authService.registerAdmin(request);
    }

    @PostMapping("/password/reset/request")
    @ResponseStatus(HttpStatus.ACCEPTED)
    void requestPasswordReset(@Valid @RequestBody AuthDtos.PasswordResetRequest request, HttpServletRequest httpRequest) {
        authService.requestPasswordReset(request.phoneE164(), deviceFingerprint(httpRequest));
    }

    @PostMapping("/password/reset")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void resetPassword(@Valid @RequestBody AuthDtos.PasswordResetConfirmRequest request, HttpServletRequest httpRequest) {
        authService.resetPassword(request.phoneE164(), request.code(), request.newPassword(), deviceFingerprint(httpRequest));
    }

    @PostMapping("/register")
    AuthDtos.TokenResponse register(@Valid @RequestBody AuthDtos.RegisterRequest request) {
        // The caller must already hold a bare, gym-less token from otp/verify
        // — AuthContextHolder carries their userId even with no grants yet.
        var userId = AuthContextHolder.get().userId();
        return authService.register(userId, request.gymId(), request.locationId(), request.role());
    }

    @PostMapping("/refresh")
    AuthDtos.TokenResponse refresh(@Valid @RequestBody AuthDtos.RefreshRequest request) {
        return authService.refresh(request.refreshToken());
    }

    @PostMapping("/sign-out")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void signOut(@Valid @RequestBody AuthDtos.RefreshRequest request) {
        authService.signOut(request.refreshToken());
    }

    /** A coarse fingerprint for rate-limit bucketing only — never used as a
     *  security boundary, and deliberately not IP-based alone (mobile
     *  networks share IPs across many devices via CGNAT). */
    private String deviceFingerprint(HttpServletRequest request) {
        String ua = request.getHeader("User-Agent");
        String ip = request.getRemoteAddr();
        return (ua == null ? "unknown-ua" : ua) + "|" + (ip == null ? "unknown-ip" : ip);
    }
}
