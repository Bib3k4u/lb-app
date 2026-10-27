package com.limitbeyond.identity.internal;

import com.limitbeyond.identity.domain.RoleGrant;
import com.limitbeyond.identity.domain.User;
import com.limitbeyond.identity.persistence.RoleGrantRepository;
import com.limitbeyond.identity.persistence.UserRepository;
import com.limitbeyond.org.api.LocationFacade;
import com.limitbeyond.platform.api.GymFacade;
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

/**
 * "Someone is asking to join your gym" — to the gym's owner(s) and the
 * location's admins. The mail only points at the console's verifications page:
 * approving a member needs a plan chosen, and a decision must be made by a
 * signed-in admin, so there is deliberately no one-click approval in this mail.
 */
@Component
class AccessRequestedAdminEmailJobHandler implements JobHandler {

    private final UserRepository userRepository;
    private final RoleGrantRepository roleGrantRepository;
    private final GymFacade gymFacade;
    private final LocationFacade locationFacade;
    private final EmailSender emailSender;
    private final EmailProperties emailProperties;

    AccessRequestedAdminEmailJobHandler(UserRepository userRepository, RoleGrantRepository roleGrantRepository,
            GymFacade gymFacade, LocationFacade locationFacade, EmailSender emailSender, EmailProperties emailProperties) {
        this.userRepository = userRepository;
        this.roleGrantRepository = roleGrantRepository;
        this.gymFacade = gymFacade;
        this.locationFacade = locationFacade;
        this.emailSender = emailSender;
        this.emailProperties = emailProperties;
    }

    @Override
    public String jobType() {
        return JobTypes.ACCESS_REQUESTED_ADMIN_EMAIL;
    }

    @Override
    @Transactional
    public void handle(Map<String, String> payload) {
        UUID userId = UUID.fromString(payload.get("userId"));
        UUID gymId = UUID.fromString(payload.get("gymId"));
        UUID locationId = UUID.fromString(payload.get("locationId"));
        String role = payload.get("role");

        User applicant = userRepository.findById(userId).orElse(null);
        if (applicant == null || applicant.getState() != User.AccountState.PENDING_VERIFICATION) {
            return; // already decided, or gone
        }
        String gymName = gymFacade.displayName(gymId).orElse("your gym");
        String branch = locationFacade.listForGym(gymId).stream()
                .filter(l -> l.id().equals(locationId)).map(LocationFacade.LocationSummary::name).findFirst().orElse("your branch");
        String who = fullName(applicant);
        String roleLabel = "TRAINER".equals(role) ? "Trainer" : "Member";
        String base = emailProperties.consoleBase();
        String url = base + "/console/verifications";

        String details = EmailLayout.eyebrowLabel("THE REQUEST")
                + EmailLayout.details(
                        "Name", who,
                        "Joining as", roleLabel,
                        "Branch", branch,
                        "Email", applicant.getEmail() == null ? "-" : applicant.getEmail(),
                        "Phone", applicant.getPhoneE164() == null ? "-" : applicant.getPhoneE164())
                + EmailLayout.paragraph("Sign in to your console to approve or decline. "
                        + ("MEMBER".equals(role) ? "You'll choose their membership plan as you approve." : "They get access as soon as you approve."));

        for (UUID adminId : recipients(gymId, locationId)) {
            User admin = userRepository.findById(adminId).orElse(null);
            if (admin == null || admin.getEmail() == null || admin.getEmail().isBlank()) {
                continue;
            }
            String name = DecisionEmails.firstNameOrThere(admin.getFirstName());
            String html = EmailLayout.render(
                    who + " wants to join " + gymName + " as a " + roleLabel.toLowerCase() + ".",
                    "ACTION NEEDED",
                    "New " + roleLabel.toLowerCase() + "<br>" + EmailLayout.highlight("awaiting approval"),
                    "Hi " + EmailLayout.strongYellow(name) + ", " + EmailLayout.escape(who) + " asked to join " + EmailLayout.escape(gymName) + " at " + EmailLayout.escape(branch) + ".",
                    details,
                    List.of(new EmailLayout.Button("Review request", url, true)),
                    "Thanks for keeping your gym running smoothly.<br><b>LimitBeyond</b>",
                    "You received this because you manage " + gymName + " on LimitBeyond.");
            String text = "Hi " + name + ", " + who + " asked to join " + gymName + " (" + branch + ") as a " + roleLabel.toLowerCase()
                    + ".\n\nReview it (sign-in required): " + url + "\n";
            emailSender.send(emailProperties.alertsSender(), admin.getEmail(),
                    "New " + roleLabel.toLowerCase() + " request: " + who, html, text, "access-requested:" + userId + ":" + adminId);
        }
    }

    /** Gym owners, plus anyone administering the branch (location or gym-wide admins). */
    private List<UUID> recipients(UUID gymId, UUID locationId) {
        return roleGrantRepository.findByGymIdAndRevokedAtIsNull(gymId).stream()
                .filter(g -> g.getRole() == RoleGrant.Role.GYM_OWNER
                        || (g.getRole() == RoleGrant.Role.LOCATION_ADMIN
                                && (g.isGymWide() || g.getLocationIds().contains(locationId))))
                .map(RoleGrant::getUserId)
                .distinct()
                .toList();
    }

    private static String fullName(User u) {
        String n = ((u.getFirstName() == null ? "" : u.getFirstName()) + " " + (u.getLastName() == null ? "" : u.getLastName())).trim();
        return n.isEmpty() ? (u.getEmail() == null ? "A new person" : u.getEmail()) : n;
    }
}
