package com.limitbeyond.shared.security;

import com.limitbeyond.shared.error.ErrorCode;
import com.limitbeyond.shared.error.ProblemJson;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

/**
 * Fires when a protected route is reached with no valid authentication at
 * all. Without this, Spring Security's default is a blank 401 with no body —
 * which would be the one place in the entire API that breaks the "one error
 * model for every failure" rule (ENG-05) simply by never routing through
 * {@code GlobalExceptionHandler} in the first place.
 */
@Component
public class ProblemDetailAuthenticationEntryPoint implements AuthenticationEntryPoint {

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException authException)
            throws IOException {
        ProblemJson.write(response, 401, ErrorCode.UNAUTHENTICATED,
                "Authentication is required to access this resource.");
    }
}
