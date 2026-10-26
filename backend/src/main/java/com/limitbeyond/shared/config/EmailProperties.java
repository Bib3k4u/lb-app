package com.limitbeyond.shared.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * {@code limitbeyond.email.*} — transactional email through Resend.
 *
 * <p>Blank {@code apiKey} switches email off: sends are skipped with a log
 * line instead of failing, so local development and any environment without
 * a key behave exactly as before.
 */
@ConfigurationProperties(prefix = "limitbeyond.email")
public record EmailProperties(String apiKey, String from, String replyTo, String consoleUrl) {

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank() && from != null && !from.isBlank();
    }
}
