package com.limitbeyond.shared.security;

import com.limitbeyond.shared.error.ErrorCode;
import com.limitbeyond.shared.error.ProblemJson;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

/**
 * Defence in depth: this pass's authorisation decisions are made in the
 * service layer via {@code auth.isAllowed(...)}, thrown as
 * {@code DomainException(FORBIDDEN)} and caught by
 * {@code GlobalExceptionHandler} — so in practice this handler rarely fires.
 * It exists so that IF Spring Security itself ever denies a request (a
 * future {@code @PreAuthorize}, for instance), the response is still our
 * Problem Details shape rather than the framework default.
 */
@Component
public class ProblemDetailAccessDeniedHandler implements AccessDeniedHandler {

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException accessDeniedException)
            throws IOException {
        ProblemJson.write(response, 403, ErrorCode.FORBIDDEN, "You do not have permission to do that.");
    }
}
