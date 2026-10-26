package com.limitbeyond.platform.internal;

import com.limitbeyond.identity.api.UserFacade;
import com.limitbeyond.org.api.LocationFacade;
import com.limitbeyond.platform.domain.Gym;
import com.limitbeyond.platform.persistence.GymRepository;
import com.limitbeyond.shared.email.EmailLayout;
import com.limitbeyond.shared.jobs.JobHandler;
import com.limitbeyond.shared.jobs.JobTypes;
import com.limitbeyond.shared.security.ActionTokenService;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** "A new gym registered" — to every Super Admin, with a one-click review link. */
@Component
class GymRegisteredAdminEmailJobHandler implements JobHandler {

    private static final DateTimeFormatter WHEN = DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a").withZone(ZoneId.of("Asia/Kolkata"));

    private final GymRepository gymRepository;
    private final LocationFacade locationFacade;
    private final UserFacade userFacade;
    private final AdminReviewMailer mailer;

    GymRegisteredAdminEmailJobHandler(GymRepository gymRepository, LocationFacade locationFacade,
            UserFacade userFacade, AdminReviewMailer mailer) {
        this.gymRepository = gymRepository;
        this.locationFacade = locationFacade;
        this.userFacade = userFacade;
        this.mailer = mailer;
    }

    @Override
    public String jobType() {
        return JobTypes.GYM_REGISTERED_ADMIN_EMAIL;
    }

    @Override
    @Transactional
    public void handle(Map<String, String> payload) {
        UUID gymId = UUID.fromString(payload.get("gymId"));
        Gym gym = gymRepository.findById(gymId).orElse(null);
        if (gym == null || gym.getState() != Gym.GymState.PENDING_VERIFICATION) {
            return; // already decided, or gone: nothing to review
        }
        var owner = userFacade.findContact(gym.getRegisteredByUserId()).orElse(null);
        var location = locationFacade.listDetailsForGym(gymId).stream().findFirst().orElse(null);
        String gymName = gym.getTradingName() == null || gym.getTradingName().isBlank() ? gym.getLegalName() : gym.getTradingName();

        String details = EmailLayout.eyebrowLabel("THE GYM")
                + EmailLayout.details(
                        "Legal name", gym.getLegalName(),
                        "Trading name", gym.getTradingName(),
                        "GSTIN", gym.getGstin(),
                        "URL", "limitbeyond.com/gyms/" + gym.getSlug(),
                        "Submitted", WHEN.format(gym.getCreatedAt()));
        if (owner != null) {
            details += EmailLayout.eyebrowLabel("REGISTERED BY")
                    + EmailLayout.details(
                            "Name", ((owner.firstName() == null ? "" : owner.firstName()) + " " + (owner.lastName() == null ? "" : owner.lastName())).trim(),
                            "Email", owner.email(),
                            "Phone", owner.phoneE164());
        }
        if (location != null) {
            details += EmailLayout.eyebrowLabel("FIRST LOCATION")
                    + EmailLayout.details(
                            "Branch", location.name(),
                            "Address", location.addressLine1() + (location.addressLine2() == null || location.addressLine2().isBlank() ? "" : ", " + location.addressLine2()),
                            "City", location.city() + ", " + location.state() + " " + location.pincode(),
                            "Branch phone", location.phoneE164());
        }

        mailer.sendToSuperAdmins(new AdminReviewMailer.Review(
                ActionTokenService.GYM_REVIEW, gymId, gymName,
                "New gym awaiting your review: " + gymName,
                gymName + " has registered on LimitBeyond and needs your approval.",
                "ACTION NEEDED",
                "New gym<br>" + EmailLayout.highlight("awaiting review"),
                gymName + " has registered on LimitBeyond and is waiting for your approval.",
                details,
                "Review & approve",
                "gym-registered-email"));
    }
}
