package com.limitbeyond.shared.error;

import org.springframework.http.HttpStatus;

/** Base of the one exception hierarchy. One error model, one response shape (ENG-05). */
public class DomainException extends RuntimeException {

    private final ErrorCode code;

    public DomainException(ErrorCode code, String message) {
        super(message);
        this.code = code;
    }

    public ErrorCode code() {
        return code;
    }

    public HttpStatus status() {
        return code.status();
    }

    public static DomainException notFound(String what) {
        // Also used for out-of-scope resources — see ErrorCode.NOT_FOUND.
        return new DomainException(ErrorCode.NOT_FOUND, what + " was not found.");
    }

    public static DomainException forbidden(String action) {
        return new DomainException(ErrorCode.FORBIDDEN, "Not permitted to " + action + ".");
    }

    public static DomainException rule(ErrorCode code, String message) {
        return new DomainException(code, message);
    }
}
