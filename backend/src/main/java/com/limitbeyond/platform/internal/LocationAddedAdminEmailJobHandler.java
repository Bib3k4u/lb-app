package com.limitbeyond.platform.internal;

import com.limitbeyond.org.api.LocationFacade;
import com.limitbeyond.platform.domain.Gym;
import com.limitbeyond.platform.persistence.GymRepository;
import com.limitbeyond.shared.email.EmailLayout;
import com.limitbeyond.shared.jobs.JobHandler;
import com.limitbeyond.shared.jobs.JobTypes;
import com.limitbeyond.shared.security.ActionTokenService;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** "A gym added a branch" — to every Super Admin, with a one-click review link. */
@Component
class LocationAddedAdminEmailJobHandler implements JobHandler {

    private final GymRepository gymRepository;
    private final LocationFacade locationFacade;
    private final AdminReviewMailer mailer;

    LocationAddedAdminEmailJobHandler(GymRepository gymRepository, LocationFacade locationFacade, AdminReviewMailer mailer) {
        this.gymRepository = gymRepository;
        this.locationFacade = locationFacade;
        this.mailer = mailer;
    }

    @Override
    public String jobType() {
        return JobTypes.LOCATION_ADDED_ADMIN_EMAIL;
    }

    @Override
    @Transactional
    public void handle(Map<String, String> payload) {
        UUID gymId = UUID.fromString(payload.get("gymId"));
        UUID locationId = UUID.fromString(payload.get("locationId"));
        Gym gym = gymRepository.findById(gymId).orElse(null);
        var location = locationFacade.listDetailsForGym(gymId).stream()
                .filter(l -> l.id().equals(locationId)).findFirst().orElse(null);
        if (gym == null || location == null || !"PENDING_REVIEW".equals(location.approvalState())) {
            return; // already decided, or gone
        }
        String gymName = gym.getTradingName() == null || gym.getTradingName().isBlank() ? gym.getLegalName() : gym.getTradingName();

        String details = EmailLayout.eyebrowLabel("THE NEW BRANCH")
                + EmailLayout.details(
                        "Gym", gymName,
                        "Branch", location.name(),
                        "Address", location.addressLine1() + (location.addressLine2() == null || location.addressLine2().isBlank() ? "" : ", " + location.addressLine2()),
                        "City", location.city() + ", " + location.state() + " " + location.pincode(),
                        "Branch phone", location.phoneE164());

        mailer.sendToSuperAdmins(new AdminReviewMailer.Review(
                ActionTokenService.LOCATION_REVIEW, locationId, gymName + " · " + location.name(),
                "New branch awaiting your review: " + location.name() + " (" + gymName + ")",
                gymName + " added a new branch and needs your approval.",
                "ACTION NEEDED",
                "New branch<br>" + EmailLayout.highlight("awaiting review"),
                gymName + " added a new branch, " + location.name() + ", and it is waiting for your approval.",
                details,
                "Review & approve",
                "location-added-email"));
    }
}
