package com.limitbeyond.shared.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** {@code limitbeyond.jwt.*} — see .env.example and ADR-08. */
@ConfigurationProperties(prefix = "limitbeyond.jwt")
public record JwtProperties(String secret, int accessTokenMinutes, int refreshTokenDays) {
}
