package com.limitbeyond.shared.error;

import com.limitbeyond.shared.ratelimit.RateLimitExceededException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * The single place an exception becomes a response. RFC 7807 Problem Details.
 *
 * <p>NN / ENG-3.2: stack traces, SQL, class names and upstream provider messages
 * never reach a client. Error responses are the most reliable reconnaissance
 * surface an attacker has and the commonest accidental disclosure path. The
 * correlation ID is the bridge — the user quotes it, and it locates the full
 * detail in the logs.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(RateLimitExceededException.class)
    public ResponseEntity<ProblemDetail> handleRateLimit(RateLimitExceededException ex) {
        ProblemDetail pd = ProblemDetail.forStatus(ex.status());
        pd.setTitle(ex.code().title());
        pd.setDetail(ex.getMessage());
        pd.setProperty("code", ex.code().name());
        pd.setProperty("correlationId", MDC.get("correlationId"));

        var decision = ex.decision();
        return ResponseEntity.status(ex.status())
                .header("RateLimit-Limit", String.valueOf(decision.limit()))
                .header("RateLimit-Remaining", String.valueOf(decision.remaining()))
                .header("RateLimit-Reset", String.valueOf(decision.resetInSeconds()))
                .header("Retry-After", String.valueOf(decision.resetInSeconds()))
                .body(pd);
    }

    @ExceptionHandler(DomainException.class)
    public ProblemDetail handleDomain(DomainException ex) {
        ProblemDetail pd = ProblemDetail.forStatus(ex.status());
        pd.setTitle(ex.code().title());
        pd.setDetail(ex.getMessage());
        pd.setProperty("code", ex.code().name());
        pd.setProperty("correlationId", MDC.get("correlationId"));
        return pd;
    }

    /** Belt and braces alongside {@code ProblemDetailAuthenticationEntryPoint} —
     *  see that class's Javadoc for why both exist. */
    @ExceptionHandler(AuthenticationException.class)
    public ProblemDetail handleAuthentication(AuthenticationException ex) {
        ProblemDetail pd = ProblemDetail.forStatus(HttpStatus.UNAUTHORIZED);
        pd.setTitle(ErrorCode.UNAUTHENTICATED.title());
        pd.setDetail("Authentication is required to access this resource.");
        pd.setProperty("code", ErrorCode.UNAUTHENTICATED.name());
        pd.setProperty("correlationId", MDC.get("correlationId"));
        return pd;
    }

    /** Belt and braces alongside {@code ProblemDetailAccessDeniedHandler}. */
    @ExceptionHandler(AccessDeniedException.class)
    public ProblemDetail handleAccessDenied(AccessDeniedException ex) {
        ProblemDetail pd = ProblemDetail.forStatus(HttpStatus.FORBIDDEN);
        pd.setTitle(ErrorCode.FORBIDDEN.title());
        pd.setDetail("You do not have permission to do that.");
        pd.setProperty("code", ErrorCode.FORBIDDEN.name());
        pd.setProperty("correlationId", MDC.get("correlationId"));
        return pd;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
        ProblemDetail pd = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        pd.setTitle(ErrorCode.VALIDATION_FAILED.title());
        pd.setDetail("One or more fields are invalid.");
        pd.setProperty("code", ErrorCode.VALIDATION_FAILED.name());
        pd.setProperty("correlationId", MDC.get("correlationId"));
        // Field names and messages only — never the submitted values, which may
        // be personal data and would then be logged by whatever consumes this.
        pd.setProperty("fields", ex.getBindingResult().getFieldErrors().stream()
                .map(f -> java.util.Map.of(
                        "field", f.getField(),
                        "message", String.valueOf(f.getDefaultMessage())))
                .toList());
        return pd;
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail handleUnexpected(Exception ex) {
        log.error("Unhandled exception", ex); // full detail to the logs…
        ProblemDetail pd = ProblemDetail.forStatus(HttpStatus.INTERNAL_SERVER_ERROR);
        pd.setTitle("Unexpected error");
        pd.setDetail("An unexpected error occurred."); // …nothing internal to the client
        pd.setProperty("correlationId", MDC.get("correlationId"));
        return pd;
    }
}
