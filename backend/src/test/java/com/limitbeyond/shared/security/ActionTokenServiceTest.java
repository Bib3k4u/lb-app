package com.limitbeyond.shared.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.limitbeyond.shared.config.JwtProperties;
import com.limitbeyond.shared.error.DomainException;
import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class ActionTokenServiceTest {

    private static ActionTokenService service(String secret) {
        return new ActionTokenService(new JwtProperties(secret, 15, 90), JsonMapper.builder().build());
    }

    @Test
    void aFreshTokenCarriesExactlyTheActionItWasIssuedFor() {
        var svc = service("a-long-test-secret-0123456789-0123456789");
        UUID target = UUID.randomUUID();
        UUID reviewer = UUID.randomUUID();

        var action = svc.verify(svc.issue(ActionTokenService.GYM_REVIEW, target, reviewer, "Fitnest Gym", Duration.ofDays(7)));

        assertThat(action.type()).isEqualTo(ActionTokenService.GYM_REVIEW);
        assertThat(action.targetId()).isEqualTo(target);
        assertThat(action.reviewerId()).isEqualTo(reviewer);
        assertThat(action.label()).isEqualTo("Fitnest Gym");
    }

    @Test
    void anAlteredPayloadIsRejected() {
        var svc = service("a-long-test-secret-0123456789-0123456789");
        String token = svc.issue(ActionTokenService.GYM_REVIEW, UUID.randomUUID(), UUID.randomUUID(), "x", Duration.ofDays(7));
        String other = svc.issue(ActionTokenService.GYM_REVIEW, UUID.randomUUID(), UUID.randomUUID(), "y", Duration.ofDays(7));
        String forged = other.substring(0, other.indexOf('.')) + token.substring(token.indexOf('.'));

        assertThatThrownBy(() -> svc.verify(forged)).isInstanceOf(DomainException.class);
    }

    @Test
    void aTokenSignedWithAnotherSecretIsRejected() {
        String token = service("secret-one-0123456789-0123456789-0123")
                .issue(ActionTokenService.LOCATION_REVIEW, UUID.randomUUID(), UUID.randomUUID(), "x", Duration.ofDays(7));

        assertThatThrownBy(() -> service("secret-two-0123456789-0123456789-0123").verify(token))
                .isInstanceOf(DomainException.class);
    }

    @Test
    void anExpiredTokenIsRejected() {
        var svc = service("a-long-test-secret-0123456789-0123456789");
        String token = svc.issue(ActionTokenService.GYM_REVIEW, UUID.randomUUID(), UUID.randomUUID(), "x", Duration.ofSeconds(-5));

        assertThatThrownBy(() -> svc.verify(token)).isInstanceOf(DomainException.class);
    }

    @Test
    void garbageIsRejectedWithoutBlowingUp() {
        var svc = service("a-long-test-secret-0123456789-0123456789");

        assertThatThrownBy(() -> svc.verify("not-a-token")).isInstanceOf(DomainException.class);
        assertThatThrownBy(() -> svc.verify(null)).isInstanceOf(DomainException.class);
        assertThatThrownBy(() -> svc.verify("a.b")).isInstanceOf(DomainException.class);
    }
}
