package com.limitbeyond.org.internal;

import com.limitbeyond.org.api.LocationFacade;
import com.limitbeyond.org.domain.Location;
import com.limitbeyond.org.domain.Location.LocationState;
import com.limitbeyond.org.persistence.LocationRepository;
import com.limitbeyond.shared.rls.RlsContext;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class LocationFacadeImpl implements LocationFacade {

    private final LocationRepository locationRepository;
    private final RlsContext rlsContext;

    LocationFacadeImpl(LocationRepository locationRepository, RlsContext rlsContext) {
        this.locationRepository = locationRepository;
        this.rlsContext = rlsContext;
    }

    // Bypassed for the same reason as GymFacadeImpl: these are existence/
    // property reads a caller with no gym-scoped AuthContext yet legitimately
    // needs (a prospective registrant; a check-in in progress), not full
    // entity reads — see RlsContext#withSystemBypass.
    @Override
    @Transactional(readOnly = true)
    public boolean existsInGym(UUID locationId, UUID gymId) {
        return rlsContext.withSystemBypass(() ->
                locationRepository.existsByIdAndGymIdAndApprovalStateAndClosedAtIsNull(
                        locationId, gymId, LocationState.APPROVED));
    }

    @Override
    @Transactional(readOnly = true)
    public double distanceMeters(UUID locationId, double latitude, double longitude) {
        Double distance = rlsContext.withSystemBypass(
                () -> locationRepository.distanceMetersNative(locationId, latitude, longitude));
        if (distance == null) {
            throw com.limitbeyond.shared.error.DomainException.notFound("Location");
        }
        return distance;
    }

    @Override
    @Transactional(readOnly = true)
    public int checkinRadiusMeters(UUID locationId) {
        return rlsContext.withSystemBypass(() -> locationRepository.findById(locationId)
                .filter(location -> location.getApprovalState() == LocationState.APPROVED && !location.isClosed())
                .orElseThrow(() -> com.limitbeyond.shared.error.DomainException.notFound("Location"))
                .getCheckinRadiusM());
    }

    @Override
    @Transactional(readOnly = true)
    public java.util.List<LocationSummary> listForGym(UUID gymId) {
        return rlsContext.withSystemBypass(() -> locationRepository.findByGymId(gymId).stream()
                .filter(l -> l.getApprovalState() == LocationState.APPROVED && !l.isClosed())
                .map(l -> new LocationSummary(l.getId(), l.getSlug(), l.getName(), l.getCity()))
                .toList());
    }

    @Override
    @Transactional(readOnly = true)
    public java.util.List<LocationDetail> listDetailsForGym(UUID gymId) {
        return rlsContext.withSystemBypass(() -> locationRepository.findByGymId(gymId).stream()
                .filter(l -> !l.isClosed())
                .map(l -> new LocationDetail(
                        l.getId(), l.getSlug(), l.getName(), l.getAddressLine1(), l.getAddressLine2(),
                        l.getCity(), l.getState(), l.getPincode(), l.getPhoneE164(), l.getApprovalState().name()))
                .toList());
    }

    @Override
    @Transactional(readOnly = true)
    public java.util.List<PublicGymListing> searchPublicGyms(String search, String state, String city,
            Double lat, Double lng, Double radiusMeters, int limit) {
        return rlsContext.withSystemBypass(() -> locationRepository
                .searchPublic(blankToNull(search), blankToNull(state), blankToNull(city), lat, lng, radiusMeters, limit)
                .stream()
                .map(row -> new PublicGymListing(
                        row.getGymId(), row.getGymSlug(), row.getGymName(), row.getLocationId(), row.getLocationName(),
                        row.getCity(), row.getState(), row.getLatitude(), row.getLongitude(), row.getDistanceM()))
                .toList());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    @Override
    @Transactional
    public UUID createInitialLocation(NewLocation location) {
        // gymId here IS the real one — PlatformService.registerGym rebuilds
        // this record with it after creating the gym; see its Javadoc.
        Location entity = new Location(location.gymId(), location.slug(), location.name(),
                location.addressLine1(), location.addressLine2(), location.city(), location.state(),
                location.pincode(), location.latitude(), location.longitude(), location.phoneE164());
        entity.markInitialLocationApproved();
        return locationRepository.save(entity).getId();
    }
}
