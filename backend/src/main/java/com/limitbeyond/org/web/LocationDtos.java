package com.limitbeyond.org.web;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

/** Public so identity.internal.LocationService can construct these directly
 *  — the same pattern AuthDtos documents for the identity module. */
public final class LocationDtos {

    private LocationDtos() {
    }

    public record CreateLocationRequest(
            @NotBlank String slug, @NotBlank String name, @NotBlank String addressLine1, String addressLine2,
            @NotBlank String city, @NotBlank String state, @NotBlank String pincode,
            double latitude, double longitude, String phoneE164) {
    }

    public record UpdateLocationRequest(
            @NotBlank String slug, @NotBlank String name, @NotBlank String addressLine1, String addressLine2,
            @NotBlank String city, @NotBlank String state, @NotBlank String pincode,
            double latitude, double longitude, String phoneE164) {
    }

    public record ReviewLocationRequest(boolean approved, String reason) {
    }

    public record LocationSummary(
            UUID id, String slug, String name, String addressLine1, String addressLine2, String city, String state,
            String pincode, String phoneE164, int checkinRadiusM, double latitude, double longitude,
            String approvalState, String rejectionReason, UUID gymId) {
    }
}
