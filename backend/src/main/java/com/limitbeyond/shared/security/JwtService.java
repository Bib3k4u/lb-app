package com.limitbeyond.shared.security;

import com.limitbeyond.shared.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * Issues and parses access tokens (LB-API-1.0 §3.1/§3.2).
 *
 * <p>Refresh tokens are deliberately NOT handled here — per ADR-08 they are
 * opaque, hashed server-side and stored in {@code refresh_tokens}, never a
 * JWT. Only the access token, which carries the caller's role grants so a
 * request never has to hit the database to learn what it may do, is a JWT.
 */
@Service
public class JwtService {

    private static final String CLAIM_STATE = "state";
    private static final String CLAIM_GRANTS = "grants";

    private final JwtProperties properties;
    private final Key signingKey;

    public JwtService(JwtProperties properties) {
        this.properties = properties;
        // HS256 needs a key of at least 256 bits (32 bytes). The bundled dev
        // default is long enough; a production secret MUST be too — a short
        // one fails fast here with WeakKeyException rather than issuing a
        // token that looks fine and is trivially forgeable.
        this.signingKey = Keys.hmacShaKeyFor(properties.secret().getBytes(StandardCharsets.UTF_8));
    }

    public String issueAccessToken(UUID userId, String accountState, List<RoleGrantClaim> grants) {
        Instant now = Instant.now();
        Instant expiry = now.plus(Duration.ofMinutes(properties.accessTokenMinutes()));

        // A HashMap, not Map.of: a SUPER_ADMIN grant has no gym (gymId is
        // genuinely null, per FR-AUTH's gym-wide/platform-wide distinction),
        // and Map.of rejects null values outright.
        List<Map<String, Object>> grantClaims = grants.stream()
                .map(g -> {
                    Map<String, Object> claim = new HashMap<>();
                    claim.put("role", g.role());
                    claim.put("gymId", g.gymId());
                    claim.put("locationIds", g.locationIds());
                    claim.put("gymWide", g.gymWide());
                    return claim;
                })
                .collect(Collectors.toList());

        return Jwts.builder()
                .subject(userId.toString())
                .claim(CLAIM_STATE, accountState)
                .claim(CLAIM_GRANTS, grantClaims)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .signWith(signingKey)
                .compact();
    }

    /**
     * @throws JwtException on any signature, format or expiry failure. The
     *     security filter treats all of these identically — 401, no further
     *     diagnosis handed back to the client (ENG-3.2).
     */
    public AccessTokenClaims parse(String token) {
        Claims claims = Jwts.parser()
                .verifyWith((javax.crypto.SecretKey) signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        UUID userId = UUID.fromString(claims.getSubject());
        String state = claims.get(CLAIM_STATE, String.class);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rawGrants = claims.get(CLAIM_GRANTS, List.class);
        List<RoleGrantClaim> grants = rawGrants == null ? List.of() : rawGrants.stream()
                .map(m -> new RoleGrantClaim(
                        (String) m.get("role"),
                        (String) m.get("gymId"),
                        castLocationIds(m.get("locationIds")),
                        Boolean.TRUE.equals(m.get("gymWide"))))
                .toList();

        return new AccessTokenClaims(userId, state, grants);
    }

    @SuppressWarnings("unchecked")
    private static List<String> castLocationIds(Object raw) {
        return raw == null ? List.of() : (List<String>) raw;
    }

    public record AccessTokenClaims(UUID userId, String accountState, List<RoleGrantClaim> grants) {
    }
}
