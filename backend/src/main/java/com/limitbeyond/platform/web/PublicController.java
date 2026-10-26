package com.limitbeyond.platform.web;

import com.limitbeyond.org.api.LocationFacade;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Genuinely public, unauthenticated reads — {@code /api/v1/public/**} is
 * already exempted end-to-end (JwtAuthenticationFilter#shouldNotFilter,
 * SecurityConfig's permitAll) precisely for endpoints like this one. Nothing
 * here may return anything beyond what {@code is_publicly_listed} already
 * marks safe for anyone to see — see LocationFacade#searchPublicGyms.
 */
@RestController
@RequestMapping("/api/v1/public")
class PublicController {

    private static final int DEFAULT_LIMIT = 30;
    private static final int MAX_LIMIT = 100;

    private final LocationFacade locationFacade;

    PublicController(LocationFacade locationFacade) {
        this.locationFacade = locationFacade;
    }

    @GetMapping("/gyms")
    List<PlatformDtos.PublicGymDto> gyms(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng,
            @RequestParam(required = false) Double radiusKm,
            @RequestParam(required = false) Integer limit) {
        int cappedLimit = Math.min(Math.max(limit == null ? DEFAULT_LIMIT : limit, 1), MAX_LIMIT);
        Double radiusMeters = radiusKm == null ? null : radiusKm * 1000;
        return locationFacade.searchPublicGyms(search, state, city, lat, lng, radiusMeters, cappedLimit)
                .stream()
                .map(PlatformDtos.PublicGymDto::from)
                .toList();
    }
}
