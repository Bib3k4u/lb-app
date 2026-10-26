package com.limitbeyond.shared.media;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.limitbeyond.shared.config.CloudinaryProperties;
import com.limitbeyond.shared.error.DomainException;
import com.limitbeyond.shared.error.ErrorCode;
import com.limitbeyond.shared.rls.AuthContextHolder;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * The one path anything in this codebase may use to reach Cloudinary — the
 * ArchUnit rule {@code onlyMediaServiceUsesCloudinary} makes that structural,
 * not a request.
 *
 * <p>NN-3: {@link #upload} takes {@link MediaAsset.Sensitivity} as a
 * REQUIRED argument, never defaulted, and it alone decides the Cloudinary
 * delivery type — a caller that has not thought about sensitivity cannot
 * accidentally publish something private, because there is no path that
 * skips the decision.
 *
 * <p>NN-4: callers get back a {@link MediaAsset} id and public id, never a
 * URL. {@link #signedUrl} is the only method that produces one, and only for
 * a caller who has already been authorised to see that specific asset.
 */
@Service
public class MediaService {

    private final Cloudinary cloudinary;
    private final CloudinaryProperties properties;
    private final MediaAssetRepository repository;

    public MediaService(Cloudinary cloudinary, CloudinaryProperties properties, MediaAssetRepository repository) {
        this.cloudinary = cloudinary;
        this.properties = properties;
        this.repository = repository;
    }

    @Transactional
    public MediaAsset upload(MultipartFile file, MediaAsset.Sensitivity sensitivity, String purpose) {
        if (!properties.isConfigured()) {
            // Fails closed and loudly rather than pretending to succeed —
            // see backend/.env.example's note on this exact behaviour.
            throw new DomainException(ErrorCode.SERVICE_UNAVAILABLE,
                    "Media storage is not configured on this environment.");
        }

        UUID userId = AuthContextHolder.get().userId();
        UUID gymId = AuthContextHolder.get().gymId();

        String type = sensitivity == MediaAsset.Sensitivity.SENSITIVE ? "authenticated" : "upload";
        Map<?, ?> uploadOptions = ObjectUtils.asMap(
                "type", type,
                "folder", "lb/" + purpose.toLowerCase(),
                "resource_type", "auto");

        Map<?, ?> result;
        try {
            result = cloudinary.uploader().upload(file.getBytes(), uploadOptions);
        } catch (IOException e) {
            throw new DomainException(ErrorCode.RULE_VIOLATION, "Could not read the uploaded file.");
        }

        String publicId = String.valueOf(result.get("public_id"));
        Long bytes = file.getSize();
        Integer width = result.get("width") != null ? ((Number) result.get("width")).intValue() : null;
        Integer height = result.get("height") != null ? ((Number) result.get("height")).intValue() : null;

        MediaAsset asset = new MediaAsset(gymId, publicId, sensitivity, file.getContentType(), bytes, width, height, userId);
        return repository.save(asset);
    }

    /** A signed delivery URL for a SENSITIVE asset. Note per ADR-15: this is
     *  Cloudinary's standard signed-URL mechanism; whether the account's plan
     *  supports true time-boxed expiry (rather than just a tamper-evident
     *  signature) should be confirmed before this ships to real members —
     *  flagged there, not silently assumed here. */
    public String signedUrl(UUID mediaId) {
        MediaAsset asset = repository.findById(mediaId)
                .orElseThrow(() -> DomainException.notFound("Media"));

        if (asset.getSensitivity() != MediaAsset.Sensitivity.SENSITIVE) {
            // A public asset's URL is constructed client-side (NN-3's client
            // half) — reaching here for one is a caller mistake, not a
            // security boundary, so it fails loudly rather than silently
            // degrading to the same signed path.
            throw new DomainException(ErrorCode.VALIDATION_FAILED,
                    "This asset is public; build its URL directly rather than requesting a signed one.");
        }

        return cloudinary.url()
                .type(asset.getDeliveryType())
                .signed(true)
                .secure(true)
                .generate(asset.getPublicId());
    }
}
