package com.limitbeyond.shared.error;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.MDC;

/**
 * Writes the same RFC 7807 Problem Details shape {@link GlobalExceptionHandler}
 * produces, for the handful of places that must respond BEFORE a request ever
 * reaches a controller — the JWT filter's account-state gate, the
 * authentication entry point, the access-denied handler. Three call sites,
 * one shape: exactly ENG-05 ("one error model... never a new variant").
 */
public final class ProblemJson {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private ProblemJson() {
    }

    public static void write(HttpServletResponse response, int status, ErrorCode code, String detail)
            throws IOException {
        response.setStatus(status);
        response.setContentType("application/problem+json");
        response.setCharacterEncoding("UTF-8");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("type", "about:blank");
        body.put("title", code.title());
        body.put("status", status);
        body.put("detail", detail);
        body.put("code", code.name());
        String correlationId = MDC.get("correlationId");
        if (correlationId != null) {
            body.put("correlationId", correlationId);
        }

        response.getWriter().write(MAPPER.writeValueAsString(body));
    }
}
