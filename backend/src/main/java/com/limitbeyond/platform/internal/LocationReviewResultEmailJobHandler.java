package com.limitbeyond.platform.internal;

import com.limitbeyond.identity.api.RoleGrantFacade;
import com.limitbeyond.identity.api.UserFacade;
import com.limitbeyond.org.api.LocationFacade;
import com.limitbeyond.platform.domain.Gym;
import com.limitbeyond.platform.persistence.GymRepository;
import com.limitbeyond.shared.config.EmailProperties;
import com.limitbeyond.shared.email.EmailLayout;
import com.limitbeyond.shared.email.EmailSender;
import com.limitbeyond.shared.jobs.JobHandler;
import com.limitbeyond.shared.jobs.JobTypes;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Tells a gym's owner(s) whether a branch they added was approved or rejected. */
@Component
class LocationReviewResultEmailJobHandler implements JobHandler {

    private final GymRepository gymRepository;
    private final LocationFacade locationFacade;
    private final RoleGrantFacade roleGrantFacade;
    private final UserFacade userFacade;
    private final EmailSender emailSender;
    private final EmailProperties emailProperties;

    LocationReviewResultEmailJobHandler(GymRepository gymRepository, LocationFacade locationFacade,
            RoleGrantFacade roleGrantFacade, UserFacade userFacade, EmailSender emailSender, EmailProperties emailProperties) {
        this.gymRepository = gymRepository;
        this.locationFacade = locationFacade;
        this.roleGrantFacade = roleGrantFacade;
        this.userFacade = userFacade;
        this.emailSender = emailSender;
        this.emailProperties = emailProperties;
    }

    @Override
    public String jobType() {
        return JobTypes.LOCATION_REVIEW_RESULT_EMAIL;
    }

    @Override
    @Transactional
    public void handle(Map<String, String> payload) {
        UUID gymId = UUID.fromString(payload.get("gymId"));
        UUID locationId = UUID.fromString(payload.get("locationId"));
        boolean approved = "APPROVED".equals(payload.get("outcome"));
        String reason = payload.getOrDefault("reason", "");
        Gym gym = gymRepository.findById(gymId).orElse(null);
        var location = locationFacade.listDetailsForGym(gymId).stream()
                .filter(l -> l.id().equals(locationId)).findFirst().orElse(null);
        if (gym == null || location == null) {
            return;
        }
        String gymName = gym.getTradingName() == null || gym.getTradingName().isBlank() ? gym.getLegalName() : gym.getTradingName();
        String base = emailProperties.consoleBase();

        for (UUID ownerId : roleGrantFacade.gymOwnerUserIds(gymId)) {
            var owner = userFacade.findContact(ownerId).orElse(null);
            if (owner == null || owner.email() == null || owner.email().isBlank()) {
                continue;
            }
            String name = owner.firstName() == null || owner.firstName().isBlank() ? "there" : owner.firstName().trim();
            String subject;
            String html;
            String text;
            if (approved) {
                subject = "Your new branch is approved: " + location.name();
                String body = EmailLayout.eyebrowLabel("THE BRANCH")
                        + EmailLayout.details("Gym", gymName, "Branch", location.name(),
                                "Address", location.addressLine1(), "City", location.city() + ", " + location.state() + " " + location.pincode())
                        + EmailLayout.paragraph("It's now live on LimitBeyond. You can start adding members, trainers and plans for this branch.");
                html = EmailLayout.render(location.name() + " has been approved.", "GOOD NEWS",
                        "Your new branch is<br>" + EmailLayout.highlight("approved"),
                        "Hi " + EmailLayout.strongYellow(name) + ", " + EmailLayout.escape(location.name()) + " at " + EmailLayout.escape(gymName) + " is approved.",
                        body, List.of(new EmailLayout.Button("Open your console", base + "/console/locations", true)),
                        "Here's to growing together.<br><b>Team Neelkanth Gym</b>",
                        "You received this because you own this gym on LimitBeyond.");
                text = "Hi " + name + ", " + location.name() + " at " + gymName + " is approved and live on LimitBeyond.\n\nOpen your console: "
                        + base + "/console/locations\n\nTeam Neelkanth Gym\n";
            } else {
                subject = "An update on your new branch: " + location.name();
                String body = EmailLayout.eyebrowLabel("WHAT WE NEED")
                        + EmailLayout.heading("Please take another look")
                        + EmailLayout.details("Branch", location.name(), "Reason", reason.isBlank() ? "No reason was given." : reason)
                        + EmailLayout.paragraph("Update the branch details in your console and it will be reviewed again, or reply to this email and we'll help.");
                html = EmailLayout.render(location.name() + " needs changes.", "AN UPDATE",
                        "Your branch needs<br>" + EmailLayout.highlight("changes"),
                        "Hi " + EmailLayout.strongYellow(name) + ", we couldn't approve " + EmailLayout.escape(location.name()) + " just yet.",
                        body, List.of(new EmailLayout.Button("Open your console", base + "/console/locations", true)),
                        "We're here to help.<br><b>Team Neelkanth Gym</b>",
                        "You received this because you own this gym on LimitBeyond.");
                text = "Hi " + name + ", we couldn't approve " + location.name() + " just yet.\n\nReason: "
                        + (reason.isBlank() ? "No reason was given." : reason) + "\n\nUpdate it in your console: " + base
                        + "/console/locations\n\nTeam Neelkanth Gym\n";
            }
            emailSender.send(owner.email(), subject, html, text, "location-review-result:" + locationId + ":" + ownerId);
        }
    }
}
