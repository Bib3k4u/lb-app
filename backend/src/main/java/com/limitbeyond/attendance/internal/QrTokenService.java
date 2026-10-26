package com.limitbeyond.attendance.internal;

import com.limitbeyond.attendance.domain.LocationQrSecret;
import com.limitbeyond.attendance.persistence.LocationQrSecretRepository;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Stable, location-scoped signed QR payloads for a code the gym can print and
 * post at the desk. The location id is not secret; what makes the token
 * unforgeable is the HMAC, keyed by a per-location secret nothing outside
 * this class sees. Replay from a photograph is prevented by the geofence
 * proof required alongside this token in {@link AttendanceService}.
 *
 * <p>Token layout, all base64url-encoded together: 1 byte format version +
 * 16 bytes location id + 32 bytes HMAC-SHA256. The output is deterministic
 * for a location until its stored signing secret is deliberately replaced.
 */
@Component
class QrTokenService {

    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final byte TOKEN_VERSION = 1;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final LocationQrSecretRepository repository;

    QrTokenService(LocationQrSecretRepository repository) {
        this.repository = repository;
    }

    @Transactional
    String issue(UUID locationId) {
        LocationQrSecret secretRow = activeSecretFor(locationId);
        byte[] hmac = sign(secretRow.getSecret(), locationId);
        return encode(locationId, hmac);
    }

    /** @return true if the token is a valid, location-matching signature. */
    @Transactional(readOnly = true)
    boolean verify(String token, UUID expectedLocationId) {
        Decoded decoded;
        try {
            decoded = decode(token);
        } catch (Exception e) {
            return false; // malformed input is just an invalid token, not a server error
        }

        if (decoded.version() != TOKEN_VERSION || !decoded.locationId().equals(expectedLocationId)) {
            return false;
        }

        LocationQrSecret secretRow = activeSecretFor(decoded.locationId());
        byte[] expectedHmac = sign(secretRow.getSecret(), decoded.locationId());
        return MessageDigest.isEqual(expectedHmac, decoded.hmac()); // constant-time comparison
    }

    private LocationQrSecret activeSecretFor(UUID locationId) {
        return repository.findByLocationIdAndActiveTrue(locationId)
                .orElseGet(() -> {
                    byte[] fresh = new byte[32];
                    RANDOM.nextBytes(fresh);
                    return repository.save(new LocationQrSecret(locationId, fresh));
                });
    }

    private static byte[] sign(byte[] secret, UUID locationId) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secret, HMAC_ALGORITHM));
            String message = "limitbeyond:check-in:location:" + locationId;
            return mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("HMAC signing failed", e);
        }
    }

    private static String encode(UUID locationId, byte[] hmac) {
        ByteBuffer buffer = ByteBuffer.allocate(1 + 16 + hmac.length);
        buffer.put(TOKEN_VERSION);
        buffer.putLong(locationId.getMostSignificantBits());
        buffer.putLong(locationId.getLeastSignificantBits());
        buffer.put(hmac);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(buffer.array());
    }

    private static Decoded decode(String token) {
        byte[] bytes = Base64.getUrlDecoder().decode(token);
        ByteBuffer buffer = ByteBuffer.wrap(bytes);
        byte version = buffer.get();
        UUID locationId = new UUID(buffer.getLong(), buffer.getLong());
        byte[] hmac = new byte[buffer.remaining()];
        buffer.get(hmac);
        return new Decoded(version, locationId, hmac);
    }

    private record Decoded(byte version, UUID locationId, byte[] hmac) {
    }
}
