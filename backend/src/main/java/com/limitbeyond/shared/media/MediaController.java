package com.limitbeyond.shared.media;

import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** LB-API-1.0 §14. Intentionally minimal in this pass — see MediaService for
 *  where the substance (NN-3/NN-4) actually lives. */
@RestController
@RequestMapping("/api/v1/media")
class MediaController {

    private final MediaService mediaService;

    MediaController(MediaService mediaService) {
        this.mediaService = mediaService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    MediaResponse upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam("sensitivity") MediaAsset.Sensitivity sensitivity,
            @RequestParam("purpose") String purpose) {
        MediaAsset asset = mediaService.upload(file, sensitivity, purpose);
        return MediaResponse.from(asset);
    }

    @PostMapping("/{id}/signed-url")
    ResponseEntity<SignedUrlResponse> signedUrl(@PathVariable UUID id) {
        return ResponseEntity.ok(new SignedUrlResponse(mediaService.signedUrl(id)));
    }

    record MediaResponse(UUID id, String publicId, String sensitivity) {
        static MediaResponse from(MediaAsset asset) {
            return new MediaResponse(asset.getId(), asset.getPublicId(), asset.getSensitivity().name());
        }
    }

    record SignedUrlResponse(String url) {
    }
}
