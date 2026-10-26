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
public record EmailProperties(String apiKey, String from, String alertsFrom, String replyTo, String consoleUrl) {

    /** Where the web console lives, without a trailing slash; used for email links. */
    public String consoleBase() {
        return consoleUrl == null || consoleUrl.isBlank() ? "https://admin.neelkanthgym.in" : consoleUrl.replaceAll("/+$", "");
    }

    /** Sender for operational alerts to the platform operators; falls back to {@code from}. */
    public String alertsSender() {
        return alertsFrom == null || alertsFrom.isBlank() ? from : alertsFrom;
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank() && from != null && !from.isBlank();
    }
}
