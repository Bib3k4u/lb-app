package com.limitbeyond.shared.email;

import com.limitbeyond.shared.config.EmailProperties;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Sends one transactional email through Resend's REST API.
 *
 * <p>Only ever called from a job handler (never from a request path or inside
 * a business transaction — CLAUDE.md NEVER #8). A non-2xx answer throws, which
 * is what makes {@code JobProcessor} retry the job later. The recipient
 * address, subject and body are never logged (NEVER #6); the user id the
 * caller passes for logging is.
 */
@Component
public class EmailSender {

    private static final Logger log = LoggerFactory.getLogger(EmailSender.class);
    private static final URI ENDPOINT = URI.create("https://api.resend.com/emails");

    private final EmailProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    public EmailSender(EmailProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    /** @return false when email is switched off (no API key), true once Resend accepted it. */
    public boolean send(String to, String subject, String html, String text, String logRef) {
        return send(properties.from(), to, subject, html, text, logRef);
    }

    /** Same, from an explicit sender (it must be on the domain verified in Resend). */
    public boolean send(String from, String to, String subject, String html, String text, String logRef) {
        if (!properties.isConfigured()) {
            log.info("Email skipped (no Resend key configured) for {}", logRef);
            return false;
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("from", from);
        body.put("to", List.of(to));
        body.put("subject", subject);
        body.put("html", html);
        body.put("text", text);
        if (properties.replyTo() != null && !properties.replyTo().isBlank()) {
            body.put("reply_to", properties.replyTo());
        }
        try {
            HttpRequest request = HttpRequest.newBuilder(ENDPOINT)
                    .timeout(Duration.ofSeconds(15))
                    .header("Authorization", "Bearer " + properties.apiKey())
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                    .build();
            HttpResponse<Void> response = http.send(request, HttpResponse.BodyHandlers.discarding());
            if (response.statusCode() / 100 != 2) {
                throw new IllegalStateException("Resend rejected the email, HTTP " + response.statusCode());
            }
            log.info("Email sent for {}", logRef);
            return true;
        } catch (IOException e) {
            throw new IllegalStateException("Could not reach Resend", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while sending email", e);
        }
    }
}
