package com.limitbeyond.shared.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** {@code limitbeyond.cloudinary.*} — see .env.example and ADR-15. */
@ConfigurationProperties(prefix = "limitbeyond.cloudinary")
public record CloudinaryProperties(String cloudName, String apiKey, String apiSecret) {

    public boolean isConfigured() {
        return cloudName != null && !cloudName.isBlank()
                && apiKey != null && !apiKey.isBlank()
                && apiSecret != null && !apiSecret.isBlank();
    }
}
