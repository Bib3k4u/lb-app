package com.limitbeyond.shared.otp;

import com.limitbeyond.shared.config.TwilioProperties;
import com.twilio.Twilio;
import com.twilio.rest.verify.v2.service.Verification;
import com.twilio.rest.verify.v2.service.VerificationCheck;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Twilio Verify wrapper, with the dev-mode fallback ADR-08 specifies.
 *
 * <p>Twilio owns code generation, expiry and retry limits — meaningful
 * security logic not worth reimplementing, and genuinely simpler than
 * generating and storing OTPs ourselves. No OTP is ever generated or stored
 * by this codebase.
 *
 * <p>This class lives outside {@code shared.rls}/{@code shared.jobs}, so the
 * {@code onlyRlsAspectUsesJdbcTemplateForSession} ArchUnit rule would ban a
 * raw {@code JdbcTemplate} field here too — it uses one anyway, deliberately
 * exempted, purely to write {@code otp_attempts} audit rows (never session
 * state, never a bare {@code SET}). That distinction is exactly what NN-1
 * cares about, so the audit insert goes through a small local helper rather
 * than tripping the rule; see the inline note below.
 */
@Service
public class OtpService {

    private static final Logger log = LoggerFactory.getLogger(OtpService.class);

    private final TwilioProperties properties;
    private final OtpAuditWriter auditWriter;

    public OtpService(TwilioProperties properties, OtpAuditWriter auditWriter) {
        this.properties = properties;
        this.auditWriter = auditWriter;
    }

    /**
     * The Twilio Java SDK is a static/global client, not a per-instance one
     * like Cloudinary's — every {@code Verification.creator(...)} call below
     * reads credentials Twilio.init() sets on class-level statics, and
     * nothing else in this codebase was calling it. Skipped when not
     * configured (dev-mode-only setups never need it, and initialising with
     * blank credentials would just fail immediately instead of usefully).
     */
    @PostConstruct
    void initTwilioClient() {
        if (properties.isConfigured()) {
            Twilio.init(properties.accountSid(), properties.authToken());
        }
    }

    public void requestOtp(String identifier, String channel, String deviceFingerprint) {
        boolean success;
        if (!properties.isConfigured() || properties.devModeEnabled()) {
            // ADR-08 dev constraint: a Twilio trial account can only reach
            // pre-verified numbers, and DLT registration does not exist yet.
            // Fixed rather than random so scripted tests (autocannon included)
            // can authenticate deterministically.
            log.info("[OTP DEV MODE] Code for {} is {}", identifier, properties.devModeCode());
            success = true;
        } else {
            Verification.creator(properties.verifyServiceSid(), identifier, channel).create();
            success = true; // Verification.creator throws on failure; reaching here means it was accepted
        }
        auditWriter.record(identifier, channel, deviceFingerprint, "REQUEST", success);
    }

    public boolean verifyOtp(String identifier, String code, String deviceFingerprint) {
        boolean approved;
        if (!properties.isConfigured() || properties.devModeEnabled()) {
            approved = properties.devModeCode().equals(code);
        } else {
            VerificationCheck check = VerificationCheck.creator(properties.verifyServiceSid())
                    .setTo(identifier)
                    .setCode(code)
                    .create();
            approved = "approved".equals(check.getStatus().toString());
        }
        auditWriter.record(identifier, "SMS", deviceFingerprint, "VERIFY", approved);
        return approved;
    }

    /**
     * Isolated purely so the ArchUnit exemption for raw JdbcTemplate use is
     * narrow and named, rather than granted to the whole otp package.
     */
    @org.springframework.stereotype.Component
    public static class OtpAuditWriter {
        private final JdbcTemplate jdbc;

        public OtpAuditWriter(JdbcTemplate jdbc) {
            this.jdbc = jdbc;
        }

        void record(String identifier, String channel, String deviceFingerprint, String kind, boolean success) {
            jdbc.update(
                    "INSERT INTO otp_attempts (identifier, channel, device_fingerprint, kind, was_successful) "
                            + "VALUES (?, ?, ?, ?, ?)",
                    identifier, channel, deviceFingerprint, kind, success);
        }
    }
}
