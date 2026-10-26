package com.limitbeyond.org.web;

import com.limitbeyond.org.internal.LocationService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** LB-API-1.0 §6. */
@RestController
@RequestMapping("/api/v1/locations")
class LocationController {

    private final LocationService locationService;

    LocationController(LocationService locationService) {
        this.locationService = locationService;
    }

    @GetMapping
    List<LocationDtos.LocationSummary> list() {
        return locationService.listForCallerGym();
    }

    @GetMapping("/live")
    List<LocationDtos.LocationSummary> live() {
        return locationService.listApprovedForCallerGym();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    LocationDtos.LocationSummary create(@Valid @RequestBody LocationDtos.CreateLocationRequest request) {
        return locationService.createLocation(
                request.slug(), request.name(), request.addressLine1(), request.addressLine2(),
                request.city(), request.state(), request.pincode(), request.latitude(), request.longitude(),
                request.phoneE164());
    }

    @PutMapping("/{locationId}")
    LocationDtos.LocationSummary update(
            @PathVariable UUID locationId,
            @Valid @RequestBody LocationDtos.UpdateLocationRequest request) {
        return locationService.updateLocation(locationId, request.slug(), request.name(), request.addressLine1(),
                request.addressLine2(), request.city(), request.state(), request.pincode(), request.latitude(),
                request.longitude(), request.phoneE164());
    }

    @GetMapping("/review-queue")
    List<LocationDtos.LocationSummary> reviewQueue() {
        return locationService.pendingReview();
    }

    @PostMapping("/{locationId}/verification")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void review(@PathVariable UUID locationId, @Valid @RequestBody LocationDtos.ReviewLocationRequest request) {
        locationService.review(locationId, request.approved(), request.reason());
    }

    @DeleteMapping("/{locationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable UUID locationId) {
        locationService.deleteLocation(locationId);
    }
}
