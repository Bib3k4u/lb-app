package com.limitbeyond.platform.internal;

import com.limitbeyond.identity.api.UserFacade;
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

/** Tells the person who registered a gym whether it was approved or rejected. */
@Component
class GymReviewResultEmailJobHandler implements JobHandler {

    private final GymRepository gymRepository;
    private final UserFacade userFacade;
    private final EmailSender emailSender;
    private final EmailProperties emailProperties;

    GymReviewResultEmailJobHandler(GymRepository gymRepository, UserFacade userFacade, EmailSender emailSender,
            EmailProperties emailProperties) {
        this.gymRepository = gymRepository;
        this.userFacade = userFacade;
        this.emailSender = emailSender;
        this.emailProperties = emailProperties;
    }

    @Override
    public String jobType() {
        return JobTypes.GYM_REVIEW_RESULT_EMAIL;
    }

    @Override
    @Transactional
    public void handle(Map<String, String> payload) {
        UUID gymId = UUID.fromString(payload.get("gymId"));
        boolean approved = "APPROVED".equals(payload.get("outcome"));
        String reason = payload.getOrDefault("reason", "");
        Gym gym = gymRepository.findById(gymId).orElse(null);
        if (gym == null) {
            return;
        }
        var owner = userFacade.findContact(gym.getRegisteredByUserId()).orElse(null);
        if (owner == null || owner.email() == null || owner.email().isBlank()) {
            return;
        }
        String gymName = gym.getTradingName() == null || gym.getTradingName().isBlank() ? gym.getLegalName() : gym.getTradingName();
        String name = owner.firstName() == null || owner.firstName().isBlank() ? "there" : owner.firstName().trim();
        String base = emailProperties.consoleBase();

        String subject;
        String html;
        String text;
        if (approved) {
            subject = gymName + " is approved on LimitBeyond";
            String body = EmailLayout.eyebrowLabel("WHAT HAPPENS NEXT")
                    + EmailLayout.heading("Activate your subscription")
                    + EmailLayout.paragraph("Your gym is verified. Our team will activate your subscription shortly, and your console unlocks the moment it goes live. We'll email you again then.")
                    + EmailLayout.feature("Verified", gymName + " passed our review.")
                    + EmailLayout.feature("Next: activation", "No action needed from you right now.");
            html = EmailLayout.render(gymName + " has been approved.", "GOOD NEWS",
                    "Your gym is<br>" + EmailLayout.highlight("approved"),
                    "Hi " + EmailLayout.strongYellow(name) + ", " + EmailLayout.escape(gymName) + " has been approved on LimitBeyond.",
                    body, List.of(new EmailLayout.Button("Check your status", base + "/admin/pending", true)),
                    "Welcome to the family.<br><b>Team Neelkanth Gym</b>",
                    "You received this because you registered a gym with this email address.");
            text = "Hi " + name + ", " + gymName + " has been approved on LimitBeyond. Our team will activate your subscription shortly and "
                    + "we'll email you when your console is live.\n\nCheck status: " + base + "/admin/pending\n\nTeam Neelkanth Gym\n";
        } else {
            subject = "An update on your gym registration: " + gymName;
            String body = EmailLayout.eyebrowLabel("WHAT WE NEED")
                    + EmailLayout.heading("Please take another look")
                    + EmailLayout.details("Reason", reason.isBlank() ? "No reason was given." : reason)
                    + EmailLayout.paragraph("Reply to this email and we'll help you sort it out, or contact us on WhatsApp at +91 98106 42646.");
            html = EmailLayout.render(gymName + " needs changes before it can be approved.", "AN UPDATE",
                    "Your gym needs<br>" + EmailLayout.highlight("changes"),
                    "Hi " + EmailLayout.strongYellow(name) + ", we couldn't approve " + EmailLayout.escape(gymName) + " just yet.",
                    body, List.of(new EmailLayout.Button("Check your status", base + "/admin/pending", true)),
                    "We're here to help.<br><b>Team Neelkanth Gym</b>",
                    "You received this because you registered a gym with this email address.");
            text = "Hi " + name + ", we couldn't approve " + gymName + " just yet.\n\nReason: " + (reason.isBlank() ? "No reason was given." : reason)
                    + "\n\nReply to this email or WhatsApp +91 98106 42646 and we'll help.\n\nTeam Neelkanth Gym\n";
        }
        emailSender.send(owner.email(), subject, html, text, "gym-review-result:" + gymId);
    }
}
