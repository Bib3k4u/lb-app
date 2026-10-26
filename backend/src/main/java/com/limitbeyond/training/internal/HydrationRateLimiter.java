package com.limitbeyond.training.internal;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.limitbeyond.shared.error.DomainException;
import com.limitbeyond.shared.error.ErrorCode;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.stereotype.Component;

/** Prevents duplicate hydration taps from creating several diary entries. */
@Component
class HydrationRateLimiter {
    private static final long COOLDOWN_NANOS = Duration.ofSeconds(3).toNanos();
    private final Cache<UUID, Long> lastAccepted = Caffeine.newBuilder()
            .expireAfterAccess(Duration.ofMinutes(5))
            .maximumSize(100_000)
            .build();

    void check(UUID userId) {
        long now = System.nanoTime();
        AtomicBoolean allowed = new AtomicBoolean(false);
        lastAccepted.asMap().compute(userId, (ignored, previous) -> {
            if (previous == null || now - previous >= COOLDOWN_NANOS) {
                allowed.set(true);
                return now;
            }
            return previous;
        });
        if (!allowed.get()) {
            throw DomainException.rule(ErrorCode.RATE_LIMITED,
                    "Please wait 3 seconds before adding another bottle.");
        }
    }
}
