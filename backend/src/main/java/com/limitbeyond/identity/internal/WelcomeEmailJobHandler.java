package com.limitbeyond.identity.internal;

import com.limitbeyond.identity.domain.User;
import com.limitbeyond.identity.persistence.UserRepository;
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
 * "Welcome to the family" — sent once a gym registration is complete (enqueued
 * by {@code PlatformService.registerGym}, in the same transaction). It says
 * where the person is and what they can do next. The payload carries only the
 * user id; the address is read here, at send time.
 */
@Component
class WelcomeEmailJobHandler implements JobHandler {

    private final UserRepository userRepository;
    private final EmailSender emailSender;
    private final EmailProperties emailProperties;

    WelcomeEmailJobHandler(UserRepository userRepository, EmailSender emailSender, EmailProperties emailProperties) {
        this.userRepository = userRepository;
        this.emailSender = emailSender;
        this.emailProperties = emailProperties;
    }

    @Override
    public String jobType() {
        return JobTypes.WELCOME_EMAIL;
    }

    @Override
    @Transactional
    public void handle(Map<String, String> payload) {
        UUID userId = UUID.fromString(payload.get("userId"));
        User user = userRepository.findById(userId).orElse(null);
        if (user == null || user.getEmail() == null || user.getEmail().isBlank()) {
            return; // nothing to send to; not an error worth retrying
        }
        String name = firstNameOrThere(user.getFirstName());
        String url = baseUrl(emailProperties.consoleUrl()) + "/console";
        emailSender.send(
                user.getEmail(),
                "Welcome to the Neelkanth Gym family",
                html(name, url),
                text(name, url),
                "welcome-email:" + userId);
    }

    private static String html(String name, String url) {
        String body = EmailLayout.eyebrowLabel("WHERE YOU ARE")
                + EmailLayout.heading("Your gym is in review")
                + EmailLayout.paragraph("Our team is checking your details. We'll email you the moment your gym is live, usually quickly.")
                + EmailLayout.eyebrowLabel("WHAT YOU CAN DO HERE")
                + EmailLayout.heading("Run every branch from one place")
                + EmailLayout.feature("Members & verifications", "Approve new joiners and keep your roster tidy.")
                + EmailLayout.feature("Locations & plans", "Add branches and set up your membership plans.")
                + EmailLayout.feature("Billing & attendance", "See who paid, who showed up and who needs a nudge.")
                + EmailLayout.feature("Feedback & insights", "Hear from members and watch your gym grow.");
        return EmailLayout.render(
                "Your gym is registered on LimitBeyond. Welcome to the Neelkanth Gym family.",
                "WELCOME ABOARD",
                "Welcome to<br>" + EmailLayout.highlight("the family"),
                "Hi " + EmailLayout.strongYellow(name) + ", your gym is registered. Welcome to the Neelkanth Gym family, and glad to have you here.",
                body,
                List.of(new EmailLayout.Button("Open your console", url, true)),
                "Here's to building something strong together.<br><b>Team Neelkanth Gym</b>",
                "You received this because a gym was registered with this email address.");
    }

    static String firstNameOrThere(String firstName) {
        return firstName == null || firstName.isBlank() ? "there" : firstName.trim();
    }

    static String baseUrl(String configured) {
        return configured == null || configured.isBlank() ? "https://admin.neelkanthgym.in" : configured.replaceAll("/+$", "");
    }

    private static String text(String name, String url) {
        return "WELCOME TO THE FAMILY\n\n"
                + "Hi " + name + ", your gym is registered on LimitBeyond by Neelkanth Gym.\n\n"
                + "What happens next: we review your gym and email you the moment it is live.\n\n"
                + "What you can do here:\n"
                + "- Manage members and verify new joiners\n"
                + "- Set up locations and membership plans\n"
                + "- Track billing and attendance\n"
                + "- Collect feedback and see insights\n\n"
                + "Open your console: " + url + "\n\n"
                + "Here's to building something strong together.\n"
                + "Team Neelkanth Gym\n"
                + "LimitBeyond by Neelkanth Gym - Laxmi Nagar & Madhu Vihar, Delhi - https://neelkanthgym.in\n";
    }
}
