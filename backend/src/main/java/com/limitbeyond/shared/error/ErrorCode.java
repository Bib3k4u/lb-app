package com.limitbeyond.shared.error;

import org.springframework.http.HttpStatus;

/**
 * Stable, machine-readable error codes. Clients switch on these; the human
 * message may change without notice (LB-ENG-1.0 §3.5).
 *
 * <p>Note {@link #NOT_FOUND} is deliberately returned for a resource that exists
 * but lies outside the caller's location scope. A 403 would confirm its
 * existence, which leaks another gym's data — exactly what NFR-SEC-01a forbids.
 */
public enum ErrorCode {

    NOT_FOUND("Not found", HttpStatus.NOT_FOUND),
    VALIDATION_FAILED("Validation failed", HttpStatus.BAD_REQUEST),
    UNAUTHENTICATED("Authentication required", HttpStatus.UNAUTHORIZED),
    // Distinct from UNAUTHENTICATED so the client refreshes rather than
    // signing the user out (LB-API-1.0 Appendix B).
    TOKEN_EXPIRED("Session expired", HttpStatus.UNAUTHORIZED),
    FORBIDDEN("Not permitted", HttpStatus.FORBIDDEN),
    ACCOUNT_PENDING("Awaiting verification", HttpStatus.FORBIDDEN),
    ACCOUNT_SUSPENDED("Account unavailable", HttpStatus.FORBIDDEN),
    CONFLICT("Conflicting state", HttpStatus.CONFLICT),
    RULE_VIOLATION("Rejected by a business rule", HttpStatus.UNPROCESSABLE_ENTITY),
    RATE_LIMITED("Too many requests", HttpStatus.TOO_MANY_REQUESTS),
    IDEMPOTENCY_KEY_REQUIRED("Idempotency-Key header required", HttpStatus.BAD_REQUEST),
    IDEMPOTENCY_KEY_REUSED("Idempotency key reused for a different request", HttpStatus.CONFLICT),

    // Domain-specific, each mapping to a requirement
    MEMBERSHIP_NOT_ACTIVE("Membership is not active", HttpStatus.UNPROCESSABLE_ENTITY),
    DUPLICATE_CHECK_IN("Already checked in", HttpStatus.CONFLICT),
    OUTSIDE_GEOFENCE("Not at this location", HttpStatus.UNPROCESSABLE_ENTITY),
    SESSION_FULL("Session is full", HttpStatus.CONFLICT),
    NO_CREDITS_REMAINING("No sessions remaining", HttpStatus.UNPROCESSABLE_ENTITY),
    GYM_NOT_LIVE("Gym subscription is not active", HttpStatus.FORBIDDEN),
    LAST_ADMIN("Cannot remove the last administrator", HttpStatus.CONFLICT),
    SCOPE_EXCEEDED("Cannot grant authority beyond your own scope", HttpStatus.FORBIDDEN),
    SERVICE_UNAVAILABLE("Dependency unavailable", HttpStatus.SERVICE_UNAVAILABLE);

    private final String title;
    private final HttpStatus status;

    ErrorCode(String title, HttpStatus status) {
        this.title = title;
        this.status = status;
    }

    public String title() {
        return title;
    }

    public HttpStatus status() {
        return status;
    }
}
