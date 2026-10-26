package com.limitbeyond.shared.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * {@code limitbeyond.google.*} — "Sign in with Google" for the web console.
 *
 * <p>{@code clientId} is the OAuth 2.0 Web client ID from Google Cloud Console.
 * It is public (it ships to the browser) but must match the {@code aud} claim
 * of every ID token we accept. Blank means Google sign-in is switched off:
 * the endpoint fails closed with 503 rather than accepting anything.
 */
@ConfigurationProperties(prefix = "limitbeyond.google")
public record GoogleAuthProperties(String clientId) {

    public boolean isConfigured() {
        return clientId != null && !clientId.isBlank();
    }
}
