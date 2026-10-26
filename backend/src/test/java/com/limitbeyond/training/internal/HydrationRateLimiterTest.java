package com.limitbeyond.training.internal;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.limitbeyond.shared.error.DomainException;
import com.limitbeyond.shared.error.ErrorCode;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class HydrationRateLimiterTest {
    @Test
    void rejectsASecondBottleForTheSameUserDuringTheCooldown() {
        HydrationRateLimiter limiter = new HydrationRateLimiter();
        UUID userId = UUID.randomUUID();

        assertThatCode(() -> limiter.check(userId)).doesNotThrowAnyException();
        assertThatThrownBy(() -> limiter.check(userId))
                .isInstanceOf(DomainException.class)
                .satisfies(error -> org.assertj.core.api.Assertions.assertThat(
                        ((DomainException) error).code()).isEqualTo(ErrorCode.RATE_LIMITED));
        assertThatCode(() -> limiter.check(UUID.randomUUID())).doesNotThrowAnyException();
    }
}
