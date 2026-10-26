package com.limitbeyond.shared.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** {@code limitbeyond.cors.*}. An explicit allowlist — never "*" on an authenticated API. */
@ConfigurationProperties(prefix = "limitbeyond.cors")
public record CorsProperties(List<String> allowedOrigins) {
}
