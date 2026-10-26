package com.limitbeyond.identity.internal;

import com.limitbeyond.identity.domain.FitnessProfile;
import com.limitbeyond.identity.domain.RefreshToken;
import com.limitbeyond.identity.domain.RoleGrant;
import com.limitbeyond.identity.domain.User;
import com.limitbeyond.identity.domain.UserConsent;
import com.limitbeyond.identity.persistence.FitnessProfileRepository;
import com.limitbeyond.identity.persistence.RefreshTokenRepository;
import com.limitbeyond.identity.persistence.RoleGrantRepository;
import com.limitbeyond.identity.persistence.UserConsentRepository;
import com.limitbeyond.identity.persistence.UserRepository;
import com.limitbeyond.identity.web.AuthDtos;
import com.limitbeyond.org.api.LocationFacade;
import com.limitbeyond.people.api.MemberFacade;
import com.limitbeyond.platform.api.GymFacade;
import com.limitbeyond.shared.config.JwtProperties;
import com.limitbeyond.shared.config.RateLimitProperties;
import com.limitbeyond.shared.error.DomainException;
import com.limitbeyond.shared.jobs.JobQueueService;
import com.limitbeyond.shared.error.ErrorCode;
import com.limitbeyond.shared.otp.OtpService;
import com.limitbeyond.shared.ratelimit.RateLimitExceededException;
import com.limitbeyond.shared.ratelimit.RateLimiter;
import com.limitbeyond.shared.rls.AuthContext;
import com.limitbeyond.shared.rls.AuthContextHolder;
import com.limitbeyond.shared.rls.RlsContext;
import com.limitbeyond.shared.security.GoogleIdTokenVerifier;
import com.limitbeyond.shared.security.JwtService;
import com.limitbeyond.shared.security.RoleGrantClaim;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The auth flows of LB-API-1.0 §4: OTP request/verify, registration against
 * a gym and location, refresh, sign-out.
 *
 * <p>Every {@code @Transactional} method here is where {@code RlsContextAspect}
 * injects RLS context (NN-1) — which matters even for auth itself: an
 * unauthenticated OTP request runs with {@code AuthContext.anonymous()},
 * whose empty scope is exactly why {@code users}/{@code fitness_profiles}
 * are RLS-exempt (LB-DATA-1.0 §16) rather than silently returning nothing to
 * a caller who cannot possibly have gym context yet.
 */
@Service
public class AuthService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private final UserRepository userRepository;
    private final FitnessProfileRepository fitnessProfileRepository;
    private final RoleGrantRepository roleGrantRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final UserConsentRepository userConsentRepository;
    private final OtpService otpService;
    private final JwtService jwtService;
    private final JwtProperties jwtProperties;
    private final RateLimiter rateLimiter;
    private final RateLimitProperties rateLimitProperties;
    private final GymFacade gymFacade;
    private final LocationFacade locationFacade;
    private final MemberFacade memberFacade;
    private final RlsContext rlsContext;
    private final PasswordEncoder passwordEncoder;
    private final GoogleIdTokenVerifier googleIdTokenVerifier;
    private final JobQueueService jobQueueService;

    public AuthService(
            UserRepository userRepository,
            FitnessProfileRepository fitnessProfileRepository,
            RoleGrantRepository roleGrantRepository,
            RefreshTokenRepository refreshTokenRepository,
            UserConsentRepository userConsentRepository,
            OtpService otpService,
            JwtService jwtService,
            JwtProperties jwtProperties,
            RateLimiter rateLimiter,
            RateLimitProperties rateLimitProperties,
            GymFacade gymFacade,
            LocationFacade locationFacade,
            MemberFacade memberFacade,
            RlsContext rlsContext,
            PasswordEncoder passwordEncoder,
            GoogleIdTokenVerifier googleIdTokenVerifier,
            JobQueueService jobQueueService) {
        this.userRepository = userRepository;
        this.fitnessProfileRepository = fitnessProfileRepository;
        this.roleGrantRepository = roleGrantRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.userConsentRepository = userConsentRepository;
        this.otpService = otpService;
        this.jwtService = jwtService;
        this.jwtProperties = jwtProperties;
        this.rateLimiter = rateLimiter;
        this.rateLimitProperties = rateLimitProperties;
        this.gymFacade = gymFacade;
        this.locationFacade = locationFacade;
        this.memberFacade = memberFacade;
        this.rlsContext = rlsContext;
        this.passwordEncoder = passwordEncoder;
        this.googleIdTokenVerifier = googleIdTokenVerifier;
        this.jobQueueService = jobQueueService;
    }

    @Transactional
    public void requestOtp(String identifier, String channel, String deviceFingerprint) {
        checkRateLimit("otp-request:" + identifier, rateLimitProperties.otpRequestPerHour());
        checkRateLimit("otp-request-device:" + deviceFingerprint, rateLimitProperties.otpRequestPerHour() * 4);
        otpService.requestOtp(identifier, channel, deviceFingerprint);
    }

    @Transactional
    public AuthDtos.TokenResponse verifyOtp(String identifier, String code, String firstName, String lastName,
            String deviceFingerprint) {
        checkRateLimit("otp-verify:" + identifier, rateLimitProperties.otpVerifyPerHour());

        boolean approved = otpService.verifyOtp(identifier, code, deviceFingerprint);
        if (!approved) {
            throw new DomainException(ErrorCode.VALIDATION_FAILED, "That code did not work.");
        }

        boolean isEmail = EMAIL_PATTERN.matcher(identifier).matches();
        User user = (isEmail ? userRepository.findByEmail(identifier) : userRepository.findByPhoneE164(identifier))
                .orElse(null);
        boolean isNewUser = user == null;
        if (isNewUser) {
            // Deliberately not requiring firstName/lastName here — the "easy
            // flow" is identifier + code first, everything else through
            // PATCH /me afterward (CompleteProfileRequest). "" satisfies
            // users.first_name/last_name's NOT NULL without pretending to
            // know a name nobody has given yet; MeResponse.profileComplete
            // is what tells the app onboarding still has to run.
            String safeFirstName = isBlank(firstName) ? "" : firstName;
            String safeLastName = isBlank(lastName) ? "" : lastName;
            user = isEmail
                    ? User.registerWithEmail(identifier, safeFirstName, safeLastName)
                    : User.registerWithPhone(identifier, safeFirstName, safeLastName);
            if (isEmail) {
                user.markEmailVerified();
            } else {
                user.markPhoneVerified();
            }
            userRepository.save(user);

            // FR-PFP-01: created in the SAME transaction as the user, always.
            fitnessProfileRepository.save(new FitnessProfile(user.getId()));
        } else if (isEmail) {
            user.markEmailVerified();
        } else {
            user.markPhoneVerified();
        }

        // user_consents and refresh_tokens both carry FORCE RLS keyed on
        // app.user_id, and this request has no JWT yet — it's the one that
        // creates the first — so JwtAuthenticationFilter never ran and
        // AuthContextHolder is still anonymous(). Establishing the caller's
        // own identity here, before the writes below, is what lets those
        // policies' "user_id = current caller" clause pass.
        //
        // reapply() is required, not optional: RlsContextAspect already fired
        // once, at this method's own entry, using the anonymous context that
        // existed then — it does not fire again for the repository calls
        // below (see its Javadoc), so nothing else pushes this change to the
        // database session.
        AuthContextHolder.set(AuthContext.noGymContext(user.getId()));
        rlsContext.reapply();
        try {
            if (isNewUser) {
                // FR-AUTH-15: consent captured at registration.
                userConsentRepository.save(new UserConsent(user.getId(), UserConsent.ConsentType.TERMS, "1.0"));
                userConsentRepository.save(new UserConsent(user.getId(), UserConsent.ConsentType.PRIVACY, "1.0"));
            }
            return issueTokens(user, deviceLabelFrom(deviceFingerprint));
        } finally {
            AuthContextHolder.clear();
        }
    }

    /** Email + password, for accounts an admin above them would otherwise
     *  send a code through — see {@code User.assignPassword}'s Javadoc. Not
     *  rate-limited per FR-AUTH-12 the way OTP is (that limit exists because
     *  every OTP costs real money to send); a generic per-identifier limit
     *  still applies here to blunt credential-stuffing. */
    @Transactional
    public AuthDtos.TokenResponse login(String email, String rawPassword, String deviceFingerprint) {
        checkRateLimit("login:" + email, rateLimitProperties.otpVerifyPerHour());

        User user = userRepository.findByEmail(email)
                .filter(u -> u.getPasswordHash() != null)
                .orElseThrow(() -> new DomainException(ErrorCode.UNAUTHENTICATED, "Incorrect email or password."));

        if (!passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
            throw new DomainException(ErrorCode.UNAUTHENTICATED, "Incorrect email or password.");
        }

        // Same bootstrap reasoning as verifyOtp(): no JWT exists yet on this
        // request, so nothing has set AuthContextHolder to this user's own
        // identity, and refresh_tokens' RLS policy needs exactly that before
        // issueTokens()'s save() below can succeed.
        AuthContextHolder.set(AuthContext.noGymContext(user.getId()));
        rlsContext.reapply();
        try {
            return issueTokens(user, deviceLabelFrom(deviceFingerprint));
        } finally {
            AuthContextHolder.clear();
        }
    }

    /** "Sign in with Google" for the web console. Google proves who the person
     *  is; it does not decide what they may do. So this only ever signs in an
     *  account that ALREADY exists (matched on Google's verified email) and
     *  issues the same tokens as every other login — grants, scope and RLS all
     *  come from the existing user, never from Google. It never creates an
     *  account: any Google user could otherwise register themselves into the
     *  platform. The same message is returned for "bad token" and "no such
     *  account" cases where possible, so this is not an account oracle. Neither
     *  the token nor the email is logged (CLAUDE.md NEVER #6). */
    @Transactional
    public AuthDtos.TokenResponse googleSignIn(String idToken, String deviceFingerprint) {
        checkRateLimit("google-sign-in-device:" + deviceFingerprint, rateLimitProperties.signInPerHour() * 4);

        GoogleIdTokenVerifier.GoogleIdentity identity = googleIdTokenVerifier.verify(idToken);
        if (!identity.emailVerified()) {
            throw new DomainException(ErrorCode.UNAUTHENTICATED, "Google sign-in failed. Please try again.");
        }
        checkRateLimit("google-sign-in:" + identity.email().toLowerCase(), rateLimitProperties.signInPerHour());

        String email = identity.email();
        User user = userRepository.findByEmail(email)
                .or(() -> userRepository.findByEmail(email.toLowerCase()))
                .orElseThrow(() -> new DomainException(
                        ErrorCode.UNAUTHENTICATED, "No account is linked to this Google account."));

        user.markEmailVerified();
        userRepository.save(user);

        // Same bootstrap as login()/verifyOtp(): no JWT exists yet on this
        // request, and refresh_tokens' RLS policy needs the caller's own
        // identity before issueTokens() can save.
        AuthContextHolder.set(AuthContext.noGymContext(user.getId()));
        rlsContext.reapply();
        try {
            return issueTokens(user, deviceLabelFrom(deviceFingerprint));
        } finally {
            AuthContextHolder.clear();
        }
    }

    /** Google-first gym-owner registration. Unlike googleSignIn this may create
     *  the account, because the registration form is itself the explicit
     *  request to create one, and Google's verified email proves ownership of
     *  the address. The new account has no password and no grants: authority
     *  still only arrives later, when the gym they register is activated
     *  (FR-AUTH-16). An already-existing account is simply signed in. */
    @Transactional
    public AuthDtos.TokenResponse googleRegister(String idToken, String deviceFingerprint) {
        checkRateLimit("google-register-device:" + deviceFingerprint, rateLimitProperties.signInPerHour() * 4);

        GoogleIdTokenVerifier.GoogleIdentity identity = googleIdTokenVerifier.verify(idToken);
        if (!identity.emailVerified()) {
            throw new DomainException(ErrorCode.UNAUTHENTICATED, "Google sign-in failed. Please try again.");
        }
        checkRateLimit("google-register:" + identity.email().toLowerCase(), rateLimitProperties.signInPerHour());

        String email = identity.email();
        User user = userRepository.findByEmail(email).or(() -> userRepository.findByEmail(email.toLowerCase())).orElse(null);
        boolean isNewUser = user == null;
        if (isNewUser) {
            user = User.registerWithEmail(
                    email.toLowerCase(),
                    isBlank(identity.givenName()) ? "" : identity.givenName().trim(),
                    isBlank(identity.familyName()) ? "" : identity.familyName().trim());
            user.markEmailVerified();
            userRepository.save(user);
            fitnessProfileRepository.save(new FitnessProfile(user.getId()));
            scheduleRegistrationReminder(user.getId());
        } else {
            user.markEmailVerified();
            userRepository.save(user);
        }

        // Same bootstrap as verifyOtp()/login(): no JWT exists yet.
        AuthContextHolder.set(AuthContext.noGymContext(user.getId()));
        rlsContext.reapply();
        try {
            if (isNewUser) {
                userConsentRepository.save(new UserConsent(user.getId(), UserConsent.ConsentType.TERMS, "1.0"));
                userConsentRepository.save(new UserConsent(user.getId(), UserConsent.ConsentType.PRIVACY, "1.0"));
            }
            return issueTokens(user, deviceLabelFrom(deviceFingerprint));
        } finally {
            AuthContextHolder.clear();
        }
    }

    @Transactional
    public void registerAdmin(AuthDtos.AdminRegistrationRequest request) {
        checkRateLimit("admin-register:" + request.phoneE164(), rateLimitProperties.otpRequestPerHour());
        if (userRepository.findByPhoneE164(request.phoneE164()).isPresent()
                || userRepository.findByEmail(request.email()).isPresent()) {
            throw new DomainException(ErrorCode.CONFLICT, "An account with this phone or email already exists.");
        }
        requireStrongPassword(request.password());
        User user = User.registerWithPhoneAndEmail(request.phoneE164(), request.email(), request.firstName().trim(), request.lastName().trim());
        user.assignPassword(passwordEncoder.encode(request.password()));
        userRepository.save(user);
        fitnessProfileRepository.save(new FitnessProfile(user.getId()));
        scheduleRegistrationReminder(user.getId());
    }

    @Transactional
    public void requestPasswordReset(String phoneE164, String deviceFingerprint) {
        checkRateLimit("password-reset:" + phoneE164, rateLimitProperties.otpRequestPerHour());
        if (userRepository.findByPhoneE164(phoneE164).isEmpty()) {
            // Keep the response indistinguishable from a real request to avoid
            // turning this endpoint into an account enumeration oracle.
            return;
        }
        otpService.requestOtp(phoneE164, "sms", deviceFingerprint);
    }

    @Transactional
    public void resetPassword(String phoneE164, String code, String newPassword, String deviceFingerprint) {
        checkRateLimit("password-reset-verify:" + phoneE164, rateLimitProperties.otpVerifyPerHour());
        requireStrongPassword(newPassword);
        if (!otpService.verifyOtp(phoneE164, code, deviceFingerprint)) {
            throw new DomainException(ErrorCode.VALIDATION_FAILED, "That code did not work.");
        }
        User user = userRepository.findByPhoneE164(phoneE164)
                .orElseThrow(() -> new DomainException(ErrorCode.VALIDATION_FAILED, "That code did not work."));
        user.assignPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    /** One call per onboarding step (name; then DOB/gender; then the fitness
     *  profile) — see CompleteProfileRequest's Javadoc for why every field
     *  is optional. Runs under the caller's own already-authenticated
     *  context (JwtAuthenticationFilter set it before this method was ever
     *  reached), and both tables it touches are RLS-exempt besides, so no
     *  RlsContext bootstrap dance is needed here the way login/verifyOtp
     *  need one. */
    @Transactional
    public AuthDtos.MeResponse completeProfile(UUID userId, AuthDtos.CompleteProfileRequest request) {
        User user = userRepository.findById(userId).orElseThrow(() -> DomainException.notFound("Account"));
        user.updateProfile(request.firstName(), request.lastName(), request.dateOfBirth(), request.gender());
        userRepository.save(user);

        FitnessProfile profile = fitnessProfileRepository.findByUserId(userId)
                .orElseThrow(() -> DomainException.notFound("Fitness profile"));
        profile.updateDetails(request.heightCm(), request.experienceLevel(), request.primaryGoal());
        fitnessProfileRepository.save(profile);

        List<RoleGrant> grants = roleGrantRepository.findByUserIdAndRevokedAtIsNull(userId);
        return toMeResponse(user, profile, grants);
    }

    @Transactional
    public AuthDtos.TokenResponse register(UUID callerUserId, String gymIdStr, String locationIdStr, String roleStr) {
        User user = userRepository.findById(callerUserId)
                .orElseThrow(() -> DomainException.notFound("Account"));

        RoleGrant.Role role;
        try {
            role = RoleGrant.Role.valueOf(roleStr);
        } catch (IllegalArgumentException e) {
            throw new DomainException(ErrorCode.VALIDATION_FAILED, "role must be MEMBER or TRAINER.");
        }
        if (role != RoleGrant.Role.MEMBER && role != RoleGrant.Role.TRAINER) {
            // FR-AUTH-16/17: admin roles are never self-served — Gym Owner
            // follows platform activation, Location Admin follows a
            // promotion by an existing admin.
            throw new DomainException(ErrorCode.FORBIDDEN, "This role cannot be self-registered.");
        }

        UUID gymId = parseUuid(gymIdStr, "gymId");
        UUID locationId = parseUuid(locationIdStr, "locationId");

        // FR-AUTH-07: no registration against a gym that is not live.
        if (!gymFacade.isLive(gymId)) {
            throw new DomainException(ErrorCode.GYM_NOT_LIVE, "This gym is not currently accepting registrations.");
        }
        if (!locationFacade.existsInGym(locationId, gymId)) {
            throw DomainException.notFound("Location");
        }

        RoleGrant grant = RoleGrant.scopedToLocations(callerUserId, gymId, role, Set.of(locationId), null);
        roleGrantRepository.save(grant);

        if (role == RoleGrant.Role.MEMBER) {
            memberFacade.createIfAbsent(callerUserId, gymId, locationId);
        }

        return issueTokens(user, null);
    }

    @Transactional
    public AuthDtos.TokenResponse refresh(String rawRefreshToken) {
        // refresh_tokens carries FORCE RLS keyed on app.user_id, and this
        // endpoint is deliberately outside the JWT filter (that's the whole
        // point of a refresh token) — there is no user identity to key off
        // of until AFTER the lookup below finds one, so even the SELECT
        // needs the same system-level bypass PlatformService/JobProcessor
        // use elsewhere. That's sound specifically because the presented
        // token's hash is itself the authorization proof — an exact match
        // on an unguessable 32-byte secret — not a general license to widen
        // this table's policy. reapply() is required for the same reason as
        // verifyOtp() — see that method's comment.
        AuthContextHolder.set(AuthContext.superAdmin(null));
        rlsContext.reapply();
        try {
            String hash = sha256(rawRefreshToken);
            RefreshToken token = refreshTokenRepository.findByTokenHash(hash)
                    .filter(RefreshToken::isValid)
                    .orElseThrow(() -> new DomainException(
                            ErrorCode.UNAUTHENTICATED, "Refresh token is invalid or expired."));

            // Rotate: the presented token dies the instant it's used, whether
            // or not anything goes wrong after this point — a refresh token
            // is meant to be single-use.
            token.revoke();

            User user = userRepository.findById(token.getUserId())
                    .orElseThrow(() -> new DomainException(ErrorCode.UNAUTHENTICATED, "Account no longer exists."));

            return issueTokens(user, null);
        } finally {
            AuthContextHolder.clear();
        }
    }

    @Transactional
    public void signOut(String rawRefreshToken) {
        // Same bootstrap bypass as refresh() and for the same reason.
        AuthContextHolder.set(AuthContext.superAdmin(null));
        rlsContext.reapply();
        try {
            refreshTokenRepository.findByTokenHash(sha256(rawRefreshToken)).ifPresent(RefreshToken::revoke);
        } finally {
            AuthContextHolder.clear();
        }
    }

    @Transactional(readOnly = true)
    public AuthDtos.MeResponse me(UUID userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> DomainException.notFound("Account"));
        FitnessProfile profile = fitnessProfileRepository.findByUserId(userId)
                .orElseThrow(() -> DomainException.notFound("Fitness profile"));
        List<RoleGrant> grants = roleGrantRepository.findByUserIdAndRevokedAtIsNull(userId);
        return toMeResponse(user, profile, grants);
    }

    // ---------------------------------------------------------------------

    private AuthDtos.TokenResponse issueTokens(User user, String deviceLabel) {
        List<RoleGrant> grants = roleGrantRepository.findByUserIdAndRevokedAtIsNull(user.getId());

        List<RoleGrantClaim> claims = grants.stream()
                .map(g -> new RoleGrantClaim(
                        g.getRole().name(),
                        g.getGymId() == null ? null : g.getGymId().toString(),
                        g.getLocationIds().stream().map(UUID::toString).toList(),
                        g.isGymWide()))
                .toList();

        String accessToken = jwtService.issueAccessToken(user.getId(), user.getState().name(), claims);

        byte[] randomBytes = new byte[32];
        RANDOM.nextBytes(randomBytes);
        String rawRefreshToken = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
        Instant expiresAt = Instant.now().plus(Duration.ofDays(jwtProperties.refreshTokenDays()));
        refreshTokenRepository.save(new RefreshToken(user.getId(), sha256(rawRefreshToken), deviceLabel, expiresAt));

        // FR-PFP-01: every user has one, unconditionally, created in the same
        // transaction as the user itself — this lookup can never miss.
        FitnessProfile profile = fitnessProfileRepository.findByUserId(user.getId())
                .orElseThrow(() -> DomainException.notFound("Fitness profile"));

        return new AuthDtos.TokenResponse(
                accessToken,
                rawRefreshToken,
                jwtProperties.accessTokenMinutes() * 60,
                toMeResponse(user, profile, grants));
    }

    private AuthDtos.MeResponse toMeResponse(User user, FitnessProfile profile, List<RoleGrant> grants) {
        List<AuthDtos.GrantView> views = grants.stream()
                .map(g -> new AuthDtos.GrantView(
                        g.getRole().name(),
                        g.getGymId() == null ? null : g.getGymId().toString(),
                        g.getLocationIds().stream().map(UUID::toString).toList(),
                        g.isGymWide()))
                .toList();
        boolean profileComplete = !isBlank(user.getFirstName()) && !isBlank(user.getLastName());
        // Only worth asking when there's actually a zero-grant ambiguity to
        // resolve — an already-scoped account never needs this field.
        AuthDtos.PendingGym pendingGym = grants.isEmpty()
                ? gymFacade.findPendingRegistrationFor(user.getId())
                        .map(g -> new AuthDtos.PendingGym(g.id(), g.slug(), g.legalName(), g.state()))
                        .orElse(null)
                : null;
        return new AuthDtos.MeResponse(
                user.getId(), user.getFirstName(), user.getLastName(), user.getEmail(), user.getPhoneE164(),
                user.getState().name(), user.getDateOfBirth(), user.getGender(),
                profile.getHeightCm(), profile.getExperienceLevel(), profile.getPrimaryGoal(),
                profileComplete, views, pendingGym);
    }

    /** An hour from now, nudge the person to finish registering — but only if they
     *  still haven't (the handler checks). Same transaction as the account, so a
     *  rolled-back sign-up schedules nothing. The welcome email is NOT sent here:
     *  it waits until the gym registration is complete (PlatformService). */
    private void scheduleRegistrationReminder(UUID userId) {
        jobQueueService.enqueue(
                com.limitbeyond.shared.jobs.JobTypes.REGISTRATION_REMINDER_EMAIL,
                java.util.Map.of("userId", userId),
                java.time.Duration.ofHours(1));
    }

    private void checkRateLimit(String key, int limitPerHour) {
        RateLimiter.Decision decision = rateLimiter.check(key, limitPerHour);
        if (!decision.allowed()) {
            throw new RateLimitExceededException(decision);
        }
    }

    private static String deviceLabelFrom(String deviceFingerprint) {
        return deviceFingerprint == null ? "unknown device" : deviceFingerprint;
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static void requireStrongPassword(String password) {
        if (password == null || password.length() < 8) {
            throw new DomainException(ErrorCode.VALIDATION_FAILED, "Password must be at least 8 characters.");
        }
    }

    private static UUID parseUuid(String value, String field) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            throw new DomainException(ErrorCode.VALIDATION_FAILED, field + " is not a valid identifier.");
        }
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
