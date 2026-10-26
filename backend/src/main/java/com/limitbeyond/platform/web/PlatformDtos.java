package com.limitbeyond.platform.web;

import com.limitbeyond.org.api.LocationFacade;
import com.limitbeyond.platform.domain.SubscriptionPayment;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class PlatformDtos {

    private PlatformDtos() {
    }

    public record LocationPayload(
            @NotBlank String slug, @NotBlank String name, @NotBlank String addressLine1, String addressLine2,
            @NotBlank String city, @NotBlank String state, @NotBlank String pincode,
            double latitude, double longitude, String phoneE164) {

        /** gymId is null — PlatformService.registerGym ignores whatever is
         *  here and stamps the real, just-created gym's id on instead;
         *  see its Javadoc for why the controller cannot know that id yet. */
        public LocationFacade.NewLocation toFacadeRecord() {
            return new LocationFacade.NewLocation(null, slug, name, addressLine1, addressLine2,
                    city, state, pincode, latitude, longitude, phoneE164);
        }
    }

    public record RegisterGymRequest(
            @NotBlank String slug, @NotBlank String legalName, String tradingName, String gstin,
            @NotNull LocationPayload location) {
    }

    /** The full picture a Super Admin needs to actually decide on a gym —
     *  not just its name and state, but who registered it, how to reach
     *  them, and where its first location is. Deliberately not called
     *  "GymDetail": this is still assembled per-row for a LIST, not a
     *  separate detail fetch — see PlatformService.pendingGyms. */
    public record GymSummary(
            UUID id, String slug, String legalName, String tradingName, String gstin, String state,
            Instant createdAt, RegistrantSummary registrant, List<LocationDetail> locations) {
    }

    public record RegistrantSummary(String firstName, String lastName, String phoneE164, String email) {
    }

    /** What a prospective member/trainer sees while choosing where to join
     *  — a LIVE gym's public identity and its locations, nothing about its
     *  subscription/billing. See PlatformService.listLiveGyms. */
    public record GymDirectoryEntry(
            UUID id, String slug, String legalName, String tradingName, List<LocationEntry> locations) {
    }

    public record LocationEntry(UUID id, String slug, String name, String city) {
    }

    public record LocationDetail(
            UUID id, String slug, String name, String addressLine1, String addressLine2,
            String city, String state, String pincode, String phoneE164, String approvalState) {
    }

    public record VerificationDecision(@NotNull Boolean approved, String reason) {
    }

    public record DeactivationRequest(@NotBlank String reason) {
    }

    public record SubscriptionPaymentRequest(
            @NotNull UUID offeringId, @Positive long amountMinor, @NotNull SubscriptionPayment.PaymentMethod method,
            String reference, @NotNull LocalDate receivedOn) {
    }

    /** See PlatformService.defaultOffering's Javadoc for why there's exactly
     *  one of these rather than a catalogue to choose from. */
    public record OfferingSummary(UUID id, String name, long priceMinor, String currency) {
    }

    /** Super-Admin-only platform revenue, from subscription_payments — never
     *  member-level billing (NFR-PRV-03: reach, not depth). See
     *  PlatformService.revenueSummary. */
    public record RevenueSummary(long totalRevenueMinor, long last30DaysRevenueMinor, List<MonthlyRevenuePoint> monthly) {
    }

    public record MonthlyRevenuePoint(String month, long amountMinor) {
    }

    /** A single card's worth of public-directory data — see
     *  LocationFacade.PublicGymListing and PublicController#gyms. */
    public record PublicGymDto(
            UUID gymId, String gymSlug, String gymName, UUID locationId, String locationName,
            String city, String state, double latitude, double longitude, Double distanceKm) {

        public static PublicGymDto from(LocationFacade.PublicGymListing listing) {
            Double distanceKm = listing.distanceMeters() == null ? null : listing.distanceMeters() / 1000.0;
            return new PublicGymDto(
                    listing.gymId(), listing.gymSlug(), listing.gymName(), listing.locationId(), listing.locationName(),
                    listing.city(), listing.state(), listing.latitude(), listing.longitude(), distanceKm);
        }
    }
}
