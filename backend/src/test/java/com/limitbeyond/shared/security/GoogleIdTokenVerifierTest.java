package com.limitbeyond.shared.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.limitbeyond.shared.config.GoogleAuthProperties;
import com.limitbeyond.shared.error.DomainException;
import com.limitbeyond.shared.error.ErrorCode;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

class GoogleIdTokenVerifierTest {

    @Test
    void failsClosedWhenNoClientIdIsConfigured() {
        var verifier = new GoogleIdTokenVerifier(new GoogleAuthProperties(""));

        assertThatThrownBy(() -> verifier.verify("any.token.here"))
                .isInstanceOfSatisfying(DomainException.class,
                        e -> assertThat(e.code()).isEqualTo(ErrorCode.SERVICE_UNAVAILABLE));
    }

    @Test
    void rejectsGarbageTokenWithAGenericUnauthenticatedError() {
        var verifier = new GoogleIdTokenVerifier(new GoogleAuthProperties("client-123.apps.googleusercontent.com"));

        assertThatThrownBy(() -> verifier.verify("not-a-jwt"))
                .isInstanceOfSatisfying(DomainException.class,
                        e -> assertThat(e.code()).isEqualTo(ErrorCode.UNAUTHENTICATED));
    }

    @Test
    void audienceValidatorOnlyAcceptsOurOwnClientIds() {
        var validator = GoogleIdTokenVerifier.audienceValidator(java.util.List.of("ours", "ours-mobile"));

        assertThat(validator.validate(jwtWith("iss", "https://accounts.google.com", "aud", "ours")).hasErrors()).isFalse();
        assertThat(validator.validate(jwtWith("iss", "https://accounts.google.com", "aud", "ours-mobile")).hasErrors()).isFalse();
        assertThat(validator.validate(jwtWith("iss", "https://accounts.google.com", "aud", "someone-else")).hasErrors()).isTrue();
    }

    @Test
    void issuerValidatorOnlyAcceptsGoogle() {
        var validator = GoogleIdTokenVerifier.issuerValidator();

        assertThat(validator.validate(jwtWith("iss", "https://accounts.google.com", "aud", "x")).hasErrors()).isFalse();
        assertThat(validator.validate(jwtWith("iss", "accounts.google.com", "aud", "x")).hasErrors()).isFalse();
        assertThat(validator.validate(jwtWith("iss", "https://evil.example", "aud", "x")).hasErrors()).isTrue();
    }

    private static Jwt jwtWith(String k1, String v1, String k2, String v2) {
        return Jwt.withTokenValue("t")
                .header("alg", "RS256")
                .claim(k1, v1)
                .claim(k2, java.util.List.of(v2))
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60))
                .build();
    }
}
