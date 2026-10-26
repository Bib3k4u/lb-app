package com.limitbeyond.shared.security;

import com.limitbeyond.shared.config.GoogleAuthProperties;
import com.limitbeyond.shared.error.DomainException;
import com.limitbeyond.shared.error.ErrorCode;
import java.util.List;
import java.util.Set;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

/**
 * Verifies a Google ID token offline: RS256 signature against Google's
 * published keys (cached by the decoder), then issuer, audience and expiry.
 * The token is never trusted until all four hold.
 *
 * <p>Fails closed: with no client ID configured, nothing is accepted.
 */
@Component
public class GoogleIdTokenVerifier {

    private static final String JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";
    private static final Set<String> ISSUERS = Set.of("https://accounts.google.com", "accounts.google.com");

    /** The few claims the sign-in flow needs. */
    public record GoogleIdentity(String subject, String email, boolean emailVerified, String givenName, String familyName) {
    }

    private final GoogleAuthProperties properties;
    private volatile JwtDecoder decoder;

    public GoogleIdTokenVerifier(GoogleAuthProperties properties) {
        this.properties = properties;
    }

    public GoogleIdentity verify(String idToken) {
        if (!properties.isConfigured()) {
            throw new DomainException(ErrorCode.SERVICE_UNAVAILABLE, "Google sign-in is not configured.");
        }
        Jwt jwt;
        try {
            jwt = decoder().decode(idToken);
        } catch (JwtException e) {
            // Deliberately vague: never echo why a token was rejected.
            throw new DomainException(ErrorCode.UNAUTHENTICATED, "Google sign-in failed. Please try again.");
        }
        String email = jwt.getClaimAsString("email");
        if (email == null || email.isBlank()) {
            throw new DomainException(ErrorCode.UNAUTHENTICATED, "Google sign-in failed. Please try again.");
        }
        return new GoogleIdentity(
                jwt.getSubject(),
                email,
                Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified")),
                jwt.getClaimAsString("given_name"),
                jwt.getClaimAsString("family_name"));
    }

    private JwtDecoder decoder() {
        JwtDecoder local = decoder;
        if (local == null) {
            synchronized (this) {
                local = decoder;
                if (local == null) {
                    NimbusJwtDecoder built = NimbusJwtDecoder.withJwkSetUri(JWKS_URI)
                            .jwsAlgorithm(SignatureAlgorithm.RS256)
                            .build();
                    built.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                            new JwtTimestampValidator(),
                            issuerValidator(),
                            audienceValidator(properties.clientId())));
                    decoder = local = built;
                }
            }
        }
        return local;
    }

    static OAuth2TokenValidator<Jwt> issuerValidator() {
        return jwt -> {
            String iss = jwt.getClaimAsString("iss");
            return iss != null && ISSUERS.contains(iss)
                    ? OAuth2TokenValidatorResult.success()
                    : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Wrong issuer", null));
        };
    }

    static OAuth2TokenValidator<Jwt> audienceValidator(String clientId) {
        return jwt -> {
            List<String> aud = jwt.getAudience();
            return aud != null && aud.contains(clientId)
                    ? OAuth2TokenValidatorResult.success()
                    : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Wrong audience", null));
        };
    }
}
