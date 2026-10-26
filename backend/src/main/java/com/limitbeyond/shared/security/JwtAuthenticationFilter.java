package com.limitbeyond.shared.security;

import com.limitbeyond.shared.error.ErrorCode;
import com.limitbeyond.shared.error.ProblemJson;
import com.limitbeyond.shared.rls.AuthContext;
import com.limitbeyond.shared.rls.AuthContextHolder;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Parses the bearer token, resolves an {@link AuthContext} for the request,
 * and gates account lifecycle state (FR-AUTH-09) — all before a controller
 * is ever reached. LB-API-1.0 §3.3 stages 1–3.
 *
 * <p>Stage 4 (the permission check itself) and stage 5 (RLS) happen later,
 * in the service layer and {@code RlsContextAspect} respectively — this
 * filter's job ends at "who is calling, and are they allowed in the door at
 * all".
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    /**
     * Exact paths a PENDING_VERIFICATION account may still reach — FR-AUTH-09.
     * A deliberately exact-match set, not a prefix match: a fresh account has
     * no grants yet, so it must be able to view its own profile, register
     * for a gym/location/role, or register a gym as a prospective owner —
     * and nothing else.
     */
    private static final Set<String> RESTRICTED_STATE_ALLOWLIST = Set.of(
            "/api/v1/me",
            "/api/v1/auth/register",
            "/api/v1/platform/gyms",
            "/api/v1/platform/gyms/directory");

    private final JwtService jwtService;

    public JwtAuthenticationFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    /** Auth sub-paths that are genuinely public — no bearer token exists yet
     *  to parse. {@code /auth/register} is deliberately NOT here: it runs as
     *  an authenticated call using the bare, gym-less token issued by
     *  otp/verify, and needs this filter to populate {@code AuthContextHolder}
     *  with that token's userId. */
    private static final Set<String> PUBLIC_AUTH_PATHS = Set.of(
            "/api/v1/auth/otp/request",
            "/api/v1/auth/otp/verify",
            "/api/v1/auth/login",
            "/api/v1/auth/google",
            "/api/v1/auth/google/register",
            "/api/v1/auth/admin/register",
            "/api/v1/auth/password/reset/request",
            "/api/v1/auth/password/reset",
            "/api/v1/auth/refresh",
            "/api/v1/auth/sign-out");

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return PUBLIC_AUTH_PATHS.contains(path)
                || path.startsWith("/api/v1/public/")
                || path.startsWith("/actuator/")
                || path.equals("/api/v1/openapi.json")
                || path.startsWith("/api/v1/docs")
                || path.startsWith("/swagger-ui")
                || path.startsWith("/v3/api-docs");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String token = extractBearerToken(request);
        if (token == null) {
            chain.doFilter(request, response); // anonymous; SecurityConfig decides if that's allowed
            return;
        }

        JwtService.AccessTokenClaims claims;
        try {
            claims = jwtService.parse(token);
        } catch (ExpiredJwtException e) {
            ProblemJson.write(response, 401, ErrorCode.TOKEN_EXPIRED,
                    "Your session has expired. Refresh and try again.");
            return;
        } catch (JwtException | IllegalArgumentException e) {
            ProblemJson.write(response, 401, ErrorCode.UNAUTHENTICATED, "The provided token is not valid.");
            return;
        }

        // FR-AUTH-09: a pending or blocked account is restricted to a small
        // allowlist, checked here so no individual controller has to remember.
        if (!"ACTIVE".equals(claims.accountState())) {
            // Exact match, not startsWith: a prefix match here would let
            // "/api/v1/me" quietly also permit a future "/api/v1/members",
            // widening the allowlist by accident as the API grows.
            boolean allowed = RESTRICTED_STATE_ALLOWLIST.contains(request.getRequestURI());
            if (!allowed) {
                ErrorCode code = "PENDING_VERIFICATION".equals(claims.accountState())
                        ? ErrorCode.ACCOUNT_PENDING
                        : ErrorCode.ACCOUNT_SUSPENDED;
                String detail = code == ErrorCode.ACCOUNT_PENDING
                        ? "Your account is awaiting verification by your gym's administrator."
                        : "This account is not currently active. Please contact your gym.";
                ProblemJson.write(response, 403, code, detail);
                return;
            }
        }

        AuthContext ctx = resolveContext(claims, request.getHeader("X-Gym-Id"));
        AuthContextHolder.set(ctx);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(claims.userId(), null, List.of()));

        try {
            chain.doFilter(request, response);
        } finally {
            AuthContextHolder.clear();
            SecurityContextHolder.clearContext();
        }
    }

    /**
     * Resolves a single active gym for the request out of a JWT that may
     * carry grants at several — the pragmatic closure of OPN-04 described on
     * {@link AuthContext}'s class Javadoc: honour {@code X-Gym-Id} when the
     * caller sends one and it names a gym they actually hold a grant at;
     * otherwise fall back to the lowest gym id among their grants, so the
     * choice is at least deterministic rather than arbitrary per request.
     */
    private AuthContext resolveContext(JwtService.AccessTokenClaims claims, String requestedGymId) {
        List<RoleGrantClaim> grants = claims.grants();

        boolean isSuperAdmin = grants.stream().anyMatch(g -> "SUPER_ADMIN".equals(g.role()));
        if (isSuperAdmin) {
            return AuthContext.superAdmin(claims.userId());
        }

        if (grants.isEmpty()) {
            return AuthContext.noGymContext(claims.userId());
        }

        String activeGymId = grants.stream().map(RoleGrantClaim::gymId).distinct()
                .filter(id -> id.equals(requestedGymId))
                .findFirst()
                .orElseGet(() -> grants.stream().map(RoleGrantClaim::gymId).distinct().min(String::compareTo)
                        .orElseThrow());

        Set<String> roles = new LinkedHashSet<>();
        Set<UUID> locationIds = new HashSet<>();
        boolean gymWide = false;
        for (RoleGrantClaim g : grants) {
            if (!g.gymId().equals(activeGymId)) {
                continue;
            }
            roles.add(g.role());
            gymWide = gymWide || g.gymWide();
            g.locationIds().forEach(id -> locationIds.add(UUID.fromString(id)));
        }

        return AuthContext.of(claims.userId(), UUID.fromString(activeGymId), roles,
                List.copyOf(locationIds), gymWide);
    }

    private String extractBearerToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }
}
