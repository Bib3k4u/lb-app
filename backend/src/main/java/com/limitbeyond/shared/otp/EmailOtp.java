package com.limitbeyond.shared.otp;

import com.limitbeyond.shared.config.EmailProperties;
import com.limitbeyond.shared.config.JwtProperties;
import com.limitbeyond.shared.email.EmailLayout;
import com.limitbeyond.shared.email.EmailSender;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.List;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;

/**
 * Sign-in codes for email addresses, sent through our own email provider.
 *
 * <p>Stateless: the code is an HMAC of the address and a 5-minute window, under
 * a key derived from the JWT secret, so nothing is stored and nothing can be
 * guessed without the key. A code is accepted for the window it was sent in and
 * the one after (5 to 10 minutes). Brute force is bounded by the per-address
 * verify rate limit in {@code AuthService}. The code is never logged.
 */
@Component
public class EmailOtp {

    private static final long WINDOW_SECONDS = 300;

    private final byte[] key;
    private final EmailSender emailSender;
    private final EmailProperties emailProperties;

    public EmailOtp(JwtProperties jwtProperties, EmailSender emailSender, EmailProperties emailProperties) {
        this.key = hmac(jwtProperties.secret().getBytes(StandardCharsets.UTF_8),
                "limitbeyond-email-otp-v1".getBytes(StandardCharsets.UTF_8));
        this.emailSender = emailSender;
        this.emailProperties = emailProperties;
    }

    /** Emails the current code. Returns whether the provider accepted it. */
    boolean send(String email) {
        String code = codeFor(email, window(Instant.now()));
        String body = EmailLayout.eyebrowLabel("YOUR CODE")
                + "<p style=\"margin:6px 0 14px;font-family:Menlo,Consolas,monospace;font-size:36px;font-weight:700;letter-spacing:6px;color:#0a0a0a;-webkit-user-select:all;user-select:all\">" + code + "</p>"
                + EmailLayout.paragraph("It works for the next few minutes. If you didn't ask for it, you can ignore this email.");
        String html = EmailLayout.render("Your LimitBeyond sign-in code is " + code, "SIGN IN",
                "Your sign-in<br>" + EmailLayout.highlight("code"),
                "Enter this code in the app to continue.", body, List.of(),
                "See you at the gym.<br><b>Team Neelkanth Gym</b>",
                "You received this because someone asked to sign in with this email address.");
        String text = "Your LimitBeyond sign-in code is " + code + ". It works for the next few minutes.\n";
        return emailSender.send(emailProperties.alertsSender(), email, "Your sign-in code: " + code, html, text, "email-otp");
    }

    boolean verify(String email, String code) {
        if (code == null) {
            return false;
        }
        long now = window(Instant.now());
        byte[] given = code.getBytes(StandardCharsets.UTF_8);
        boolean ok = false;
        for (long w = now; w >= now - 1; w--) {
            ok |= MessageDigest.isEqual(given, codeFor(email, w).getBytes(StandardCharsets.UTF_8));
        }
        return ok;
    }

    private String codeFor(String email, long window) {
        byte[] mac = hmac(key, (email.toLowerCase() + "|" + window).getBytes(StandardCharsets.UTF_8));
        int n = ((mac[0] & 0x7f) << 24) | ((mac[1] & 0xff) << 16) | ((mac[2] & 0xff) << 8) | (mac[3] & 0xff);
        return String.format("%06d", n % 1_000_000);
    }

    private static long window(Instant t) {
        return t.getEpochSecond() / WINDOW_SECONDS;
    }

    private static byte[] hmac(byte[] key, byte[] data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(data);
        } catch (java.security.GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
