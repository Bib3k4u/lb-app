package com.limitbeyond.shared.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * {@code limitbeyond.jwt.twilio.*} — see .env.example and ADR-08.
 *
 * <p>{@code devModeEnabled} MUST be false wherever a real member might reach
 * the API. It exists because a single Twilio Verify trial account can only
 * send to pre-verified numbers, and this codebase runs before DLT
 * registration exists at all — see LB-ARCH-1.0 ADR-08's development
 * constraint.
 */
@ConfigurationProperties(prefix = "limitbeyond.twilio")
public record TwilioProperties(
        String accountSid,
        String authToken,
        String verifyServiceSid,
        boolean devModeEnabled,
        String devModeCode) {

    public boolean isConfigured() {
        return accountSid != null && !accountSid.isBlank()
                && authToken != null && !authToken.isBlank()
                && verifyServiceSid != null && !verifyServiceSid.isBlank();
    }
}
