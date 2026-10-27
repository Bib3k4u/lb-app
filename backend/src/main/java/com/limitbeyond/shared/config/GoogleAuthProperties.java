package com.limitbeyond.shared.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * {@code limitbeyond.google.*} — "Sign in with Google" for the web console.
 *
 * <p>{@code clientId} is the OAuth 2.0 Web client ID from Google Cloud Console.
 * It is public (it ships to the browser) but must match the {@code aud} claim
 * of every ID token we accept (a comma-separated list is allowed, so the
 * mobile app's own Google clients can be accepted alongside the web one). Blank means Google sign-in is switched off:
 * the endpoint fails closed with 503 rather than accepting anything.
 */
@ConfigurationProperties(prefix = "limitbeyond.google")
public record GoogleAuthProperties(String clientId) {

    /** The accepted audiences: the web client plus, optionally, the mobile app's
     *  iOS/Android clients, all given in {@code clientId} separated by commas. */
    public java.util.List<String> clientIds() {
        if (clientId == null) {
            return java.util.List.of();
        }
        return java.util.Arrays.stream(clientId.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    public boolean isConfigured() {
        return !clientIds().isEmpty();
    }
}
