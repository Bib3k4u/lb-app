package com.limitbeyond.shared.observability;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Every log line and every error response carries a correlation id
 * (LB-API-1.0 §2.10, LB-ENG-1.0 §12) — the bridge between "the user quotes
 * this in a support message" and "the full detail sitting in the logs".
 *
 * <p>Runs before everything else in the chain ({@code Ordered.HIGHEST_PRECEDENCE})
 * so the id is available to every subsequent filter, including
 * {@code JwtAuthenticationFilter}'s error responses.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter extends OncePerRequestFilter {

    private static final String HEADER = "X-Request-Id";
    private static final String RESPONSE_HEADER = "X-Correlation-Id";
    private static final String MDC_KEY = "correlationId";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String correlationId = request.getHeader(HEADER);
        if (correlationId == null || correlationId.isBlank()) {
            correlationId = UUID.randomUUID().toString();
        }

        MDC.put(MDC_KEY, correlationId);
        response.setHeader(RESPONSE_HEADER, correlationId);

        try {
            chain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_KEY); // defensive — see AuthContextHolder's note on virtual threads
        }
    }
}
