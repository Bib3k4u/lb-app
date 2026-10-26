package com.limitbeyond.org.internal;

import com.limitbeyond.org.domain.Location;
import com.limitbeyond.org.domain.Location.LocationState;
import com.limitbeyond.org.persistence.LocationRepository;
import com.limitbeyond.org.web.LocationDtos;
import com.limitbeyond.shared.error.DomainException;
import com.limitbeyond.shared.error.ErrorCode;
import com.limitbeyond.shared.rls.AuthContext;
import com.limitbeyond.shared.rls.AuthContextHolder;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** LB-SRS-1.1 M2 / FR-ORG-03. */
@Service
public class LocationService {

    private final LocationRepository locationRepository;

    private final com.limitbeyond.shared.jobs.JobQueueService jobQueueService;

    public LocationService(LocationRepository locationRepository,
            com.limitbeyond.shared.jobs.JobQueueService jobQueueService) {
        this.locationRepository = locationRepository;
        this.jobQueueService = jobQueueService;
    }

    /** FR-ORG-03: only the Gym Owner may create a location. NN-5: scope and
     *  role checked before anything else runs. */
    @Transactional
    public LocationDtos.LocationSummary createLocation(String slug, String name, String addressLine1,
            String addressLine2, String city, String state, String pincode, double latitude, double longitude,
            String phoneE164) {
        AuthContext caller = AuthContextHolder.get();
        if (!caller.gymWide() && !caller.superAdmin()) {
            throw DomainException.forbidden("create a location");
        }
        Location location = new Location(caller.gymId(), slug, name, addressLine1, addressLine2,
                city, state, pincode, latitude, longitude, phoneE164);
        location = locationRepository.save(location);
        // A branch added by a gym owner waits for Super Admin review: tell them.
        // (A Super Admin adding one is the reviewer, so nobody needs telling.)
        if (!caller.superAdmin()) {
            jobQueueService.enqueue(com.limitbeyond.shared.jobs.JobTypes.LOCATION_ADDED_ADMIN_EMAIL,
                    java.util.Map.of("gymId", caller.gymId(), "locationId", location.getId()));
        }
        return toSummary(location);
    }

    @Transactional(readOnly = true)
    public List<LocationDtos.LocationSummary> listForCallerGym() {
        UUID gymId = AuthContextHolder.get().gymId();
        if (gymId == null) {
            return List.of();
        }
        return locationRepository.findByGymId(gymId).stream()
                .filter(location -> !location.isClosed())
                .map(this::toSummary).toList();
    }

    @Transactional(readOnly = true)
    public List<LocationDtos.LocationSummary> listApprovedForCallerGym() {
        UUID gymId = AuthContextHolder.get().gymId();
        if (gymId == null) {
            return List.of();
        }
        return locationRepository.findByGymId(gymId).stream()
                .filter(location -> location.getApprovalState() == LocationState.APPROVED && !location.isClosed())
                .map(this::toSummary).toList();
    }

    @Transactional
    public LocationDtos.LocationSummary updateLocation(UUID locationId, String slug, String name,
            String addressLine1, String addressLine2, String city, String state, String pincode,
            double latitude, double longitude, String phoneE164) {
        AuthContext caller = AuthContextHolder.get();
        if (!caller.gymWide()) {
            throw DomainException.forbidden("edit a location");
        }
        Location location = locationRepository.findById(locationId)
                .filter(item -> item.getGymId().equals(caller.gymId()) && !item.isClosed())
                .orElseThrow(() -> DomainException.notFound("Location"));
        location.update(slug, name, addressLine1, addressLine2, city, state, pincode,
                latitude, longitude, phoneE164);
        return toSummary(locationRepository.save(location));
    }

    @Transactional(readOnly = true)
    public List<LocationDtos.LocationSummary> pendingReview() {
        requireSuperAdmin();
        return locationRepository.findByApprovalStateAndClosedAtIsNullOrderByCreatedAtAsc(LocationState.PENDING_REVIEW)
                .stream().map(this::toSummary).toList();
    }

    @Transactional
    public void review(UUID locationId, boolean approved, String reason) {
        requireSuperAdmin();
        if (!approved && (reason == null || reason.isBlank())) {
            throw new DomainException(ErrorCode.VALIDATION_FAILED, "A rejection reason is required.");
        }
        Location location = locationRepository.findById(locationId)
                .filter(item -> !item.isClosed())
                .orElseThrow(() -> DomainException.notFound("Location"));
        if (location.getApprovalState() != LocationState.PENDING_REVIEW) {
            throw new DomainException(ErrorCode.CONFLICT, "This location is no longer awaiting review.");
        }
        location.review(approved, AuthContextHolder.get().userId(), reason == null ? null : reason.trim());
        locationRepository.save(location);
        java.util.Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("gymId", location.getGymId());
        payload.put("locationId", location.getId());
        payload.put("outcome", approved ? "APPROVED" : "REJECTED");
        payload.put("reason", approved || reason == null ? "" : reason.trim());
        jobQueueService.enqueue(com.limitbeyond.shared.jobs.JobTypes.LOCATION_REVIEW_RESULT_EMAIL, payload);
    }

    @Transactional
    public void deleteLocation(UUID locationId) {
        AuthContext caller = AuthContextHolder.get();
        if (!caller.gymWide()) {
            throw DomainException.forbidden("delete a location");
        }
        Location location = locationRepository.findById(locationId)
                .filter(item -> item.getGymId().equals(caller.gymId()) && !item.isClosed())
                .orElseThrow(() -> DomainException.notFound("Location"));
        location.close();
        locationRepository.save(location);
    }

    private void requireSuperAdmin() {
        if (!AuthContextHolder.get().superAdmin()) {
            throw DomainException.forbidden("review locations");
        }
    }

    private LocationDtos.LocationSummary toSummary(Location location) {
        return new LocationDtos.LocationSummary(
                location.getId(), location.getSlug(), location.getName(), location.getAddressLine1(),
                location.getAddressLine2(), location.getCity(), location.getState(), location.getPincode(),
                location.getPhoneE164(), location.getCheckinRadiusM(), location.getLatitude(),
                location.getLongitude(), location.getApprovalState().name(), location.getRejectionReason(),
                location.getGymId());
    }
}
