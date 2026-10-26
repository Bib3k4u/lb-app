package com.limitbeyond.platform.internal;

import com.limitbeyond.identity.api.RoleGrantFacade;
import com.limitbeyond.identity.api.UserFacade;
import com.limitbeyond.shared.config.EmailProperties;
import com.limitbeyond.shared.email.EmailLayout;
import com.limitbeyond.shared.email.EmailSender;
import com.limitbeyond.shared.security.ActionTokenService;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Sends one "needs your review" email to every Super Admin. Each recipient gets
 * their own signed review link, so a decision made from the email is attributed
 * to the person who clicked. Shared by the gym-registered and branch-added jobs.
 */
@Component
class AdminReviewMailer {

    private static final Duration LINK_LIFETIME = Duration.ofDays(7);

    private final RoleGrantFacade roleGrantFacade;
    private final UserFacade userFacade;
    private final ActionTokenService actionTokenService;
    private final EmailSender emailSender;
    private final EmailProperties emailProperties;

    AdminReviewMailer(RoleGrantFacade roleGrantFacade, UserFacade userFacade, ActionTokenService actionTokenService,
            EmailSender emailSender, EmailProperties emailProperties) {
        this.roleGrantFacade = roleGrantFacade;
        this.userFacade = userFacade;
        this.actionTokenService = actionTokenService;
        this.emailSender = emailSender;
        this.emailProperties = emailProperties;
    }

    /** What differs between the two kinds of review mail. */
    record Review(String tokenType, UUID targetId, String label, String subject, String preheader,
            String eyebrow, String titleHtml, String intro, String detailsHtml, String approveLabel, String logRef) {
    }

    void sendToSuperAdmins(Review review) {
        String base = emailProperties.consoleUrl() == null || emailProperties.consoleUrl().isBlank()
                ? "https://admin.neelkanthgym.in"
                : emailProperties.consoleUrl().replaceAll("/+$", "");
        for (UUID adminId : roleGrantFacade.superAdminUserIds()) {
            var contact = userFacade.findContact(adminId).orElse(null);
            if (contact == null || contact.email() == null || contact.email().isBlank()) {
                continue;
            }
            String token = actionTokenService.issue(review.tokenType(), review.targetId(), adminId, review.label(), LINK_LIFETIME);
            String reviewUrl = base + "/admin/review?t=" + token;
            String name = contact.firstName() == null || contact.firstName().isBlank() ? "there" : contact.firstName().trim();

            String body = review.detailsHtml()
                    + EmailLayout.paragraph("You can approve or reject right from the review page, no sign-in needed. The link is personal to you and expires in 7 days.");
            String html = EmailLayout.render(
                    review.preheader(),
                    review.eyebrow(),
                    review.titleHtml(),
                    "Hi " + EmailLayout.strongYellow(name) + ", " + EmailLayout.escape(review.intro()),
                    body,
                    List.of(
                            new EmailLayout.Button(review.approveLabel(), reviewUrl, true),
                            new EmailLayout.Button("Open console", base + "/console/gyms", false)),
                    "Thanks for keeping the platform safe.<br><b>LimitBeyond</b>",
                    "You received this because you are a LimitBeyond Super Admin.");
            String text = "Hi " + name + ", " + review.intro() + "\n\n" + review.approveLabel() + ": " + reviewUrl
                    + "\nOr open the console: " + base + "/console/gyms\n\nThe review link is personal to you and expires in 7 days.\n";
            emailSender.send(emailProperties.alertsSender(), contact.email(), review.subject(), html, text, review.logRef() + ":" + adminId);
        }
    }
}
