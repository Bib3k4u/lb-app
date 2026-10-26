package com.limitbeyond.identity.internal;

import com.limitbeyond.identity.domain.User;
import com.limitbeyond.identity.persistence.RoleGrantRepository;
import com.limitbeyond.identity.persistence.UserRepository;
import com.limitbeyond.platform.api.GymFacade;
import com.limitbeyond.shared.config.EmailProperties;
import com.limitbeyond.shared.email.EmailSender;
import com.limitbeyond.shared.jobs.JobHandler;
import com.limitbeyond.shared.jobs.JobTypes;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * A gentle nudge, an hour after sign-up, for people who created an account but
 * never filled in their gym details. Scheduled at sign-up; re-checked here at
 * send time, so anyone who finished in the meantime (they hold a grant, or have
 * a gym awaiting review) gets nothing. Sent at most once per account.
 */
@Component
class RegistrationReminderJobHandler implements JobHandler {

    private static final String TEMPLATE = EmailTemplates.load("reminder.html");

    private final UserRepository userRepository;
    private final RoleGrantRepository roleGrantRepository;
    private final GymFacade gymFacade;
    private final EmailSender emailSender;
    private final EmailProperties emailProperties;

    RegistrationReminderJobHandler(UserRepository userRepository, RoleGrantRepository roleGrantRepository,
            GymFacade gymFacade, EmailSender emailSender, EmailProperties emailProperties) {
        this.userRepository = userRepository;
        this.roleGrantRepository = roleGrantRepository;
        this.gymFacade = gymFacade;
        this.emailSender = emailSender;
        this.emailProperties = emailProperties;
    }

    @Override
    public String jobType() {
        return JobTypes.REGISTRATION_REMINDER_EMAIL;
    }

    @Override
    @Transactional
    public void handle(Map<String, String> payload) {
        UUID userId = UUID.fromString(payload.get("userId"));
        User user = userRepository.findById(userId).orElse(null);
        if (user == null || user.getEmail() == null || user.getEmail().isBlank()) {
            return;
        }
        boolean hasAccess = !roleGrantRepository.findByUserIdAndRevokedAtIsNull(userId).isEmpty();
        boolean gymSubmitted = gymFacade.findPendingRegistrationFor(userId).isPresent();
        if (hasAccess || gymSubmitted) {
            return; // already finished — no reminder
        }
        String name = EmailTemplates.firstNameOrThere(user.getFirstName());
        String url = EmailTemplates.baseUrl(emailProperties.consoleUrl()) + "/admin/register";
        emailSender.send(
                user.getEmail(),
                name.equals("there")
                        ? "You're one step away from your gym on LimitBeyond"
                        : name + ", you're one step away from your gym on LimitBeyond",
                EmailTemplates.fill(TEMPLATE, name, url),
                text(name, url),
                "registration-reminder:" + userId);
    }

    private static String text(String name, String url) {
        return "Hi " + name + ",\n\n"
                + "You started setting up your gym on LimitBeyond by Neelkanth Gym, and you're one step away.\n"
                + "It takes about 2 minutes, and what you've already entered is saved.\n\n"
                + "Finish setting up: " + url + "\n\n"
                + "Once it's done you can manage members, plans, billing, attendance and feedback for every branch from one console.\n\n"
                + "Team Neelkanth Gym\n"
                + "LimitBeyond by Neelkanth Gym - https://neelkanthgym.in\n";
    }
}
