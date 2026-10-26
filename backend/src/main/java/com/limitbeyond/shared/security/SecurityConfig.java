package com.limitbeyond.shared.security;

import com.limitbeyond.shared.config.CorsProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Stateless JWT security. LB-API-1.0 §3, LB-ENG-1.0 §7.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final ProblemDetailAuthenticationEntryPoint authenticationEntryPoint;
    private final ProblemDetailAccessDeniedHandler accessDeniedHandler;
    private final CorsProperties corsProperties;

    public SecurityConfig(
            JwtAuthenticationFilter jwtAuthenticationFilter,
            ProblemDetailAuthenticationEntryPoint authenticationEntryPoint,
            ProblemDetailAccessDeniedHandler accessDeniedHandler,
            CorsProperties corsProperties) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.authenticationEntryPoint = authenticationEntryPoint;
        this.accessDeniedHandler = accessDeniedHandler;
        this.corsProperties = corsProperties;
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // Stateless JWT API: no cookies, no CSRF token to steal.
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(handling -> handling
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .authorizeHttpRequests(auth -> auth
                        // Public: no account needed at all. Kept as the exact same
                        // set JwtAuthenticationFilter.PUBLIC_AUTH_PATHS skips —
                        // /auth/register is deliberately NOT here, since it needs
                        // the caller's own (bare, gym-less) token.
                        .requestMatchers(
                                "/api/v1/auth/otp/request", "/api/v1/auth/otp/verify", "/api/v1/auth/login", "/api/v1/auth/google", "/api/v1/auth/google/register",
                                "/api/v1/auth/refresh", "/api/v1/auth/sign-out", "/api/v1/auth/admin/register",
                                "/api/v1/auth/password/reset/request", "/api/v1/auth/password/reset",
                                "/api/v1/public/**", "/api/v1/platform/email-actions/decide",
                                "/actuator/health", "/actuator/health/**", "/actuator/info",
                                "/api/v1/openapi.json", "/api/v1/docs/**", "/swagger-ui/**", "/v3/api-docs/**")
                        .permitAll()
                        // Everything else requires a valid, non-expired access token.
                        // Account-lifecycle gating (pending/suspended) happens earlier,
                        // inside JwtAuthenticationFilter — by the time a request reaches
                        // this matcher it has already cleared that check.
                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    private CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        // An explicit allowlist, never "*" on an authenticated API (LB-ENG-1.0 §7).
        configuration.setAllowedOrigins(corsProperties.allowedOrigins());
        configuration.setAllowedMethods(java.util.List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(java.util.List.of(
                "Authorization", "Content-Type", "Idempotency-Key", "X-Gym-Id", "X-Request-Id"));
        configuration.setExposedHeaders(java.util.List.of(
                "X-Correlation-Id", "Idempotency-Replayed", "RateLimit-Limit", "RateLimit-Remaining",
                "RateLimit-Reset", "Retry-After"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    /** Argon2 is the standard's recommendation (LB-ENG §7); BCrypt is the
     *  pragmatic, well-supported default here for the same reason JWT over a
     *  bespoke scheme is: it is a battle-tested Spring Security primitive
     *  requiring no extra dependency, and is still far beyond what an
     *  attacker can brute-force at the cost of a single extra library choice
     *  Argon2 would require (spring-security-crypto's Argon2 support pulls in
     *  BouncyCastle). Revisit if a security review asks for it specifically. */
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
