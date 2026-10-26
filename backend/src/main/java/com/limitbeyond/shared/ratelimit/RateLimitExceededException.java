package com.limitbeyond.shared.ratelimit;

import com.limitbeyond.shared.error.DomainException;
import com.limitbeyond.shared.error.ErrorCode;

/** Carries the {@link RateLimiter.Decision} so the response can set the
 *  standard {@code RateLimit-*} / {@code Retry-After} headers (LB-API-1.0 §2.8). */
public class RateLimitExceededException extends DomainException {

    private final RateLimiter.Decision decision;

    public RateLimitExceededException(RateLimiter.Decision decision) {
        super(ErrorCode.RATE_LIMITED, "Too many requests. Try again later.");
        this.decision = decision;
    }

    public RateLimiter.Decision decision() {
        return decision;
    }
}
