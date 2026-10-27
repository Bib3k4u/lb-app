package com.limitbeyond.identity.internal;

import com.limitbeyond.identity.domain.User;
import com.limitbeyond.identity.persistence.UserRepository;
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
 * Sent to a member or trainer once an admin decides: a "hello and welcome, here
 * is how to start" mail on approval, or a polite decline with the reason.
 */
@Component
class AccessDecisionEmailJobHandler implements JobHandler {

    private final UserRepository userRepository;
    private final GymFacade gymFacade;
    private final EmailSender emailSender;
    private final EmailProperties emailProperties;

    AccessDecisionEmailJobHandler(UserRepository userRepository, GymFacade gymFacade, EmailSender emailSender,
            EmailProperties emailProperties) {
        this.userRepository = userRepository;
        this.gymFacade = gymFacade;
        this.emailSender = emailSender;
        this.emailProperties = emailProperties;
    }

    @Override
    public String jobType() {
        return JobTypes.ACCESS_DECISION_EMAIL;
    }

    @Override
    @Transactional
    public void handle(Map<String, String> payload) {
        UUID userId = UUID.fromString(payload.get("userId"));
        UUID gymId = UUID.fromString(payload.get("gymId"));
        boolean approved = "APPROVED".equals(payload.get("outcome"));
        boolean trainer = "TRAINER".equals(payload.get("role"));
        String reason = payload.getOrDefault("reason", "");

        User user = userRepository.findById(userId).orElse(null);
        if (user == null || user.getEmail() == null || user.getEmail().isBlank()) {
            return;
        }
        String gymName = gymFacade.displayName(gymId).orElse("the gym");
        String name = DecisionEmails.firstNameOrThere(user.getFirstName());
        String roleLabel = trainer ? "trainer" : "member";

        String subject;
        String html;
        String text;
        if (approved) {
            subject = "Welcome to " + gymName + "!";
            String steps = trainer
                    ? EmailLayout.feature("1. Open the app", "Sign in with the same Google account.")
                            + EmailLayout.feature("2. See your members", "Members assigned to you appear on your dashboard.")
                            + EmailLayout.feature("3. Track and coach", "Check attendance and keep plans on track.")
                    : EmailLayout.feature("1. Open the app", "Sign in with the same Google account.")
                            + EmailLayout.feature("2. Check in", "Scan in at the gym and your streak starts.")
                            + EmailLayout.feature("3. Make a plan", "Log workouts and meals, and watch your progress.");
            String body = EmailLayout.eyebrowLabel("HOW TO START") + EmailLayout.heading("You're ready to go") + steps;
            html = EmailLayout.render("Your access to " + gymName + " is approved.", "WELCOME ABOARD",
                    "Hello and welcome<br>to " + EmailLayout.highlight(gymName),
                    "Hi " + EmailLayout.strongYellow(name) + ", your request was approved. You're now a " + roleLabel + " at "
                            + EmailLayout.escape(gymName) + ".",
                    body, List.of(new EmailLayout.Button("Visit the gym", "https://neelkanthgym.in", false)),
                    "Here's to getting stronger together.<br><b>Team Neelkanth Gym</b>",
                    "You received this because you asked for access to " + gymName + ".");
            text = "Hello " + name + ", welcome to " + gymName + "! Your request was approved and you're now a " + roleLabel
                    + ".\n\nHow to start:\n1. Open the LimitBeyond app and sign in with the same Google account.\n"
                    + (trainer ? "2. Your assigned members appear on your dashboard.\n3. Track attendance and keep plans on track.\n"
                            : "2. Check in at the gym and your streak starts.\n3. Log workouts and meals and watch your progress.\n")
                    + "\nTeam Neelkanth Gym\n";
        } else {
            subject = "An update on your request to join " + gymName;
            String body = EmailLayout.eyebrowLabel("WHAT HAPPENED")
                    + EmailLayout.details("Reason", reason.isBlank() ? "No reason was given." : reason)
                    + EmailLayout.paragraph("Please speak to the front desk, or WhatsApp us at +91 98106 42646, and we'll sort it out.");
            html = EmailLayout.render("Your request to join " + gymName + " wasn't approved.", "AN UPDATE",
                    "About your<br>" + EmailLayout.highlight("request"),
                    "Hi " + EmailLayout.strongYellow(name) + ", we couldn't approve your request to join " + EmailLayout.escape(gymName) + " this time.",
                    body, List.of(), "We're here to help.<br><b>Team Neelkanth Gym</b>",
                    "You received this because you asked for access to " + gymName + ".");
            text = "Hi " + name + ", we couldn't approve your request to join " + gymName + " this time.\n\nReason: "
                    + (reason.isBlank() ? "No reason was given." : reason)
                    + "\n\nSpeak to the front desk or WhatsApp +91 98106 42646.\n\nTeam Neelkanth Gym\n";
        }
        emailSender.send(user.getEmail(), subject, html, text, "access-decision:" + userId + ":" + gymId);
    }
}
