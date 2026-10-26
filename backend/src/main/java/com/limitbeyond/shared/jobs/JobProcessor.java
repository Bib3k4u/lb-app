package com.limitbeyond.shared.jobs;

import tools.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * The {@code @Transactional} half of job processing, deliberately split into
 * its own bean.
 *
 * <p>Spring's proxy-based AOP does not intercept self-invocation — a call
 * from one method to another on the same instance ({@code this.foo()})
 * bypasses the proxy entirely, so an {@code @Transactional} method called
 * that way would silently run with NO transaction, and therefore with no RLS
 * context either. Splitting this into a bean that {@link JobWorker} calls
 * through its injected (proxied) reference is what makes the annotation
 * actually take effect. Getting this wrong is invisible in a quick manual
 * test and only shows up as unexplained RLS failures under load — exactly
 * the kind of mistake worth a permanent comment.
 */
@Component
public class JobProcessor {

    private static final Logger log = LoggerFactory.getLogger(JobProcessor.class);
    private static final int MAX_ATTEMPTS = 8;

    private final JdbcTemplate jdbc;
    // tools.jackson (Jackson 3), not com.fasterxml.jackson: Boot 4's
    // JacksonAutoConfiguration (spring-boot-starter-jackson) publishes a
    // Jackson 3 ObjectMapper bean, not the classic Jackson 2 one — the
    // classic package is only reachable here at all because jjwt-jackson
    // pulls it in transitively, and there is no Spring-managed bean of it.
    private final ObjectMapper objectMapper;
    private final Map<String, JobHandler> handlersByType;

    /**
     * Takes {@code List<JobHandler>} rather than a {@code Map} — Spring would
     * happily autowire a {@code Map<String, JobHandler>} too, but keyed by
     * BEAN NAME, not {@link JobHandler#jobType()}. Building the map here from
     * the list avoids that trap entirely rather than relying on bean names
     * matching job type strings by convention.
     */
    public JobProcessor(JdbcTemplate jdbc, ObjectMapper objectMapper, List<JobHandler> handlers) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.handlersByType = handlers.stream().collect(Collectors.toMap(JobHandler::jobType, h -> h));
        log.info("Job worker registered {} handler(s): {}", handlers.size(), handlersByType.keySet());
    }

    // Deliberately does NOT set AuthContextHolder itself, even though this
    // is the @Transactional boundary — RlsContextAspect's @Before advice
    // (order 200) fires when TransactionInterceptor (order 100) opens the
    // transaction, which is BEFORE this method's own body runs. Setting the
    // context in here would apply it one call too late, after RLS's session
    // variables had already been populated from whatever context existed
    // before this call. JobWorker sets it before calling process(), which is
    // what makes it visible in time — see JobWorker's Javadoc.
    @Transactional
    public void process(ClaimedJob job) {
        try {
            JobHandler handler = handlersByType.get(job.jobType());
            if (handler == null) {
                markFailed(job, "No handler registered for job type " + job.jobType());
                return;
            }
            handler.handle(readPayload(job.payloadJson()));
            jdbc.update("UPDATE job_queue SET state = 'SUCCEEDED' WHERE id = ?", job.id());
        } catch (Exception e) {
            log.warn("Job {} ({}) failed on attempt {}", job.id(), job.jobType(), job.attempts() + 1, e);
            markFailed(job, e.getMessage());
        }
    }

    private void markFailed(ClaimedJob job, String error) {
        int attempts = job.attempts() + 1;
        if (attempts >= MAX_ATTEMPTS) {
            jdbc.update("UPDATE job_queue SET state = 'DEAD', attempts = ?, last_error = ? WHERE id = ?",
                    attempts, error, job.id());
        } else {
            long backoffSeconds = (long) Math.pow(2, attempts); // 2s, 4s, 8s, ...
            jdbc.update(
                    "UPDATE job_queue SET state = 'PENDING', attempts = ?, last_error = ?, "
                            + "run_after = now() + ? WHERE id = ?",
                    attempts, error, Duration.ofSeconds(backoffSeconds), job.id());
        }
    }

    private Map<String, String> readPayload(String json) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> raw = objectMapper.readValue(json, Map.class);
            return raw.entrySet().stream().collect(Collectors.toMap(
                    Map.Entry::getKey, e -> e.getValue() == null ? null : e.getValue().toString()));
        } catch (Exception e) {
            throw new IllegalStateException("Malformed job payload: " + json, e);
        }
    }
}
