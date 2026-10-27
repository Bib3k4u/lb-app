package com.limitbeyond.identity.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.util.List;
import java.util.UUID;

/**
 * Request/response records for the auth endpoints — LB-API-1.0 §4.
 *
 * <p>Public, and constructed directly by {@code identity.internal.AuthService}
 * rather than mapped from a domain object by the controller. That is a
 * conscious looser-than-aspirational reading of the web/internal split (the
 * STANDARDS doc's fuller form has services return domain objects and
 * controllers map them to DTOs) — chosen for less ceremony across this
 * pass's ~15 endpoints. Nothing in {@code ArchitectureRulesTest} forbids it:
 * the banned direction is {@code web} depending on {@code domain}, not the
 * reverse, and {@code AuthDtos} is a plain record holder, not a Spring web
 * type.
 */
public final class AuthDtos {

    private AuthDtos() {
    }

    // Accepts either an Indian mobile number in E.164 form or an email
    // address — the app lets a person start with whichever they have to
    // hand, matching this identifier through to whichever of
    // User.registerWithPhone/registerWithEmail applies (see AuthService).
    static final String IDENTIFIER_PATTERN = "^(\\+91[6-9]\\d{9}|[^\\s@]+@[^\\s@]+\\.[^\\s@]+)$";

    public record OtpRequestRequest(
            @NotBlank @Pattern(regexp = IDENTIFIER_PATTERN, message = "must be a valid phone number (+91...) or email address")
            String identifier,
            @NotBlank String channel) {
    }

    public record OtpVerifyRequest(
            @NotBlank @Pattern(regexp = IDENTIFIER_PATTERN, message = "must be a valid phone number (+91...) or email address")
            String identifier,
            @NotBlank @Pattern(regexp = "^\\d{6}$", message = "must be a 6-digit code") String code,
            // Deliberately NOT required, even for a brand-new identifier: the
            // "easy flow" is identifier + code first, name and everything
            // else after, via PATCH /me — see AuthService.verifyOtp and
            // CompleteProfileRequest below.
            String firstName,
            String lastName) {
    }

    /** Email + password — the one account type FR-AUTH-03 already excludes
     *  from self-registration (a Super Admin) uses this instead of OTP, since
     *  there is no admin-above-them to send a verification code through. */
    public record LoginRequest(@NotBlank String email, @NotBlank String password) {
    }

    /** The ID token Google's browser SDK hands the console after the user
     *  picks an account. Verified server-side; see AuthService.googleSignIn. */
    public record GoogleLoginRequest(@NotBlank String idToken,
            /** Optional: "app" when the member/trainer mobile app is signing in. */
            String client) {
    }

    public record AdminRegistrationRequest(
            @NotBlank @Pattern(regexp = "^\\+91[6-9]\\d{9}$", message = "must be a valid Indian phone number (+91...)") String phoneE164,
            @NotBlank @Pattern(regexp = "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", message = "must be a valid email address") String email,
            @NotBlank String password,
            @NotBlank String firstName,
            @NotBlank String lastName) {
    }

    public record PasswordResetRequest(
            @NotBlank @Pattern(regexp = "^\\+91[6-9]\\d{9}$", message = "must be a valid Indian phone number (+91...)") String phoneE164) {
    }

    public record PasswordResetConfirmRequest(
            @NotBlank @Pattern(regexp = "^\\+91[6-9]\\d{9}$", message = "must be a valid Indian phone number (+91...)") String phoneE164,
            @NotBlank @Pattern(regexp = "^\\d{6}$", message = "must be a 6-digit code") String code,
            @NotBlank String newPassword) {
    }

    /** Every field optional and applied only if present — the app calls this
     *  once per onboarding step (name, then details, then fitness profile),
     *  not all at once, so a person can stop after any step and pick up
     *  later without losing what they already entered. */
    public record CompleteProfileRequest(
            String firstName,
            String lastName,
            java.time.LocalDate dateOfBirth,
            String gender,
            java.math.BigDecimal heightCm,
            String experienceLevel,
            String primaryGoal) {
    }

    public record RegisterRequest(
            @NotBlank String gymId,
            @NotBlank String locationId,
            @NotBlank String role // MEMBER | TRAINER
    ) {
    }

    public record RefreshRequest(@NotBlank String refreshToken) {
    }

    public record TokenResponse(String accessToken, String refreshToken, int expiresIn, MeResponse user) {
    }

    public record MeResponse(
            UUID id, String firstName, String lastName, String email, String phoneE164, String state,
            java.time.LocalDate dateOfBirth, String gender,
            java.math.BigDecimal heightCm, String experienceLevel, String primaryGoal,
            // The app's single source of truth for "does onboarding still
            // need to run" — computed here, not re-derived client-side, so
            // the rule for what counts as complete lives in exactly one
            // place. Currently just name; widen this the day a step becomes
            // mandatory rather than skippable.
            boolean profileComplete,
            List<GrantView> grants,
            // Non-null only when this person registered a gym that isn't
            // LIVE yet (FR-AUTH-16: Gym Owner is granted on activation, not
            // registration) — the app's signal to show "your gym is under
            // review" instead of bouncing a zero-grant account back to
            // "choose a path" in a loop. See GymFacade.findPendingRegistrationFor.
            PendingGym pendingGym) {
    }

    public record GrantView(String role, String gymId, List<String> locationIds, boolean gymWide) {
    }

    public record PendingGym(UUID id, String slug, String legalName, String state) {
    }
}
