package com.limitbeyond.shared.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** {@code limitbeyond.rate-limit.*} — see LB-API-1.0 §2.8. */
@ConfigurationProperties(prefix = "limitbeyond.rate-limit")
public record RateLimitProperties(
        int otpRequestPerHour,
        int otpVerifyPerHour,
        int signInPerHour,
        int checkInPerHour) {
}
