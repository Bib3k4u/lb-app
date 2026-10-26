package com.limitbeyond.shared.ratelimit;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.stereotype.Component;

/**
 * Fixed-window, per-key rate limiting. LB-API-1.0 §2.8 / ADR-09's reasoning
 * applies equally here: at one instance's scale, an in-memory counter is
 * enough, and a great deal simpler to reason about than a distributed
 * limiter nothing yet requires. No Redis.
 *
 * <p>Deliberately a plain fixed window rather than a sliding one — good
 * enough for "5 OTP requests per hour", and the extra precision a sliding
 * window buys is not worth the extra bookkeeping at this scale. If this ever
 * needs to run across more than one instance, the fix is a shared store
 * (Redis <code>INCR</code> + <code>EXPIRE</code>), not a smarter algorithm.
 */
@Component
public class RateLimiter {

    private final Cache<String, AtomicInteger> windows = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofHours(1))
            .maximumSize(100_000)
            .build();

    /**
     * @return the outcome, including how many seconds until the window
     *     resets — used to set {@code RateLimit-*} / {@code Retry-After}
     *     response headers regardless of whether the request is allowed.
     */
    public Decision check(String key, int limitPerHour) {
        AtomicInteger counter = windows.get(key, k -> new AtomicInteger(0));
        int used = counter.incrementAndGet();
        long resetInSeconds = 3600; // fixed window: always "the rest of this hour" from first hit
        if (used > limitPerHour) {
            return new Decision(false, 0, limitPerHour, resetInSeconds);
        }
        return new Decision(true, Math.max(0, limitPerHour - used), limitPerHour, resetInSeconds);
    }

    public record Decision(boolean allowed, int remaining, int limit, long resetInSeconds) {
    }
}
