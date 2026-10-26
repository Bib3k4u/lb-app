package com.limitbeyond.shared.security;

import com.limitbeyond.shared.config.JwtProperties;
import com.limitbeyond.shared.error.DomainException;
import com.limitbeyond.shared.error.ErrorCode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Signed, expiring tokens for actions taken from an email link — today, a Super
 * Admin approving or rejecting a gym or branch straight from the notification
 * mail. A token names exactly one action on exactly one target for exactly one
 * reviewer, and expires; it is an HMAC-SHA256 over its payload under a key
 * derived from the JWT secret, so it cannot be forged or altered.
 *
 * <p>Opening the link does nothing by itself: the page it leads to must make an
 * explicit POST, so mail scanners that pre-fetch links cannot trigger an
 * approval. Replays are harmless because the decision endpoints reject a gym
 * or location that is no longer awaiting review.
 */
@Component
public class ActionTokenService {

    public static final String GYM_REVIEW = "GYM_REVIEW";
    public static final String LOCATION_REVIEW = "LOCATION_REVIEW";

    /** What a verified token says. {@code label} is display text only. */
    public record Action(String type, UUID targetId, UUID reviewerId, String label) {
    }

    private final byte[] key;
    private final ObjectMapper objectMapper;

    public ActionTokenService(JwtProperties jwtProperties, ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        // A separate sub-key, so an email token can never double as anything else.
        this.key = hmac(jwtProperties.secret().getBytes(StandardCharsets.UTF_8),
                "limitbeyond-email-action-v1".getBytes(StandardCharsets.UTF_8));
    }

    public String issue(String type, UUID targetId, UUID reviewerId, String label, Duration ttl) {
        String payload = objectMapper.createObjectNode()
                .put("t", type)
                .put("i", targetId.toString())
                .put("r", reviewerId.toString())
                .put("l", label == null ? "" : label)
                .put("x", Instant.now().plus(ttl).getEpochSecond())
                .toString();
        String encoded = Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        return encoded + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(hmac(key, encoded.getBytes(StandardCharsets.UTF_8)));
    }

    public Action verify(String token) {
        try {
            int dot = token == null ? -1 : token.indexOf('.');
            if (dot < 1) {
                throw invalid();
            }
            String encoded = token.substring(0, dot);
            byte[] given = Base64.getUrlDecoder().decode(token.substring(dot + 1));
            byte[] expected = hmac(key, encoded.getBytes(StandardCharsets.UTF_8));
            if (!MessageDigest.isEqual(given, expected)) {
                throw invalid();
            }
            JsonNode node = objectMapper.readTree(new String(Base64.getUrlDecoder().decode(encoded), StandardCharsets.UTF_8));
            if (node.get("x").asLong() < Instant.now().getEpochSecond()) {
                throw new DomainException(ErrorCode.UNAUTHENTICATED, "This review link has expired. Open the console to review it.");
            }
            return new Action(node.get("t").asString(), UUID.fromString(node.get("i").asString()),
                    UUID.fromString(node.get("r").asString()), node.get("l").asString());
        } catch (DomainException e) {
            throw e;
        } catch (RuntimeException e) {
            throw invalid();
        }
    }

    private static DomainException invalid() {
        return new DomainException(ErrorCode.UNAUTHENTICATED, "This review link is not valid.");
    }

    private static byte[] hmac(byte[] key, byte[] data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(data);
        } catch (java.security.GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
