package com.limitbeyond.shared.jobs;

import com.limitbeyond.shared.rls.AuthContext;
import com.limitbeyond.shared.rls.AuthContextHolder;
import java.util.UUID;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Claims jobs and hands each one to {@link JobProcessor}. ADR-09:
 * {@code SELECT ... FOR UPDATE SKIP LOCKED} so a second instance's worker
 * never blocks on, or duplicates, a job this one already holds.
 *
 * <p>Claiming happens here, OUTSIDE a Spring-managed transaction (a plain
 * {@code JdbcTemplate} call, autocommitting the claim immediately) so a
 * claimed row is visible to other workers as {@code CLAIMED} the instant
 * it's claimed, rather than staying locked for the duration of whatever the
 * handler does. The actual job logic — and its RLS context — lives entirely
 * in {@link JobProcessor#process}, called through its injected (proxied)
 * reference so its {@code @Transactional} annotation actually takes effect;
 * see that class's Javadoc for why that distinction matters.
 *
 * <p>The RLS context is set HERE, immediately before that call — not inside
 * {@code process()} itself. {@code RlsContextAspect}'s advice fires when the
 * transaction opens, which happens on entry to the proxied call, before
 * {@code process()}'s own body would get a chance to set anything. Setting
 * it a call frame earlier, right before crossing into the proxy, is what
 * makes it visible in time.
 */
@Component
public class JobWorker {

    private static final int BATCH_SIZE = 20;

    private final JdbcTemplate jdbc;
    private final JobProcessor jobProcessor;

    public JobWorker(JdbcTemplate jdbc, JobProcessor jobProcessor) {
        this.jdbc = jdbc;
        this.jobProcessor = jobProcessor;
    }

    @Scheduled(fixedDelay = 2000)
    public void drain() {
        for (int i = 0; i < BATCH_SIZE; i++) {
            if (!claimAndProcessOne()) {
                return; // nothing left to claim this tick
            }
        }
    }

    /** @return true if a job was found (whether it succeeded or failed) */
    private boolean claimAndProcessOne() {
        ClaimedJob job;
        try {
            job = jdbc.queryForObject(
                    """
                    UPDATE job_queue SET state = 'CLAIMED', claimed_at = now()
                    WHERE id = (
                        SELECT id FROM job_queue
                        WHERE state = 'PENDING' AND run_after <= now()
                        ORDER BY priority DESC, run_after
                        FOR UPDATE SKIP LOCKED
                        LIMIT 1
                    )
                    RETURNING id, job_type, payload::text, attempts
                    """,
                    (rs, rowNum) -> new ClaimedJob(
                            (UUID) rs.getObject("id"),
                            rs.getString("job_type"),
                            rs.getString("payload"),
                            rs.getInt("attempts")));
        } catch (EmptyResultDataAccessException e) {
            return false;
        }

        AuthContextHolder.set(AuthContext.superAdmin(null));
        try {
            jobProcessor.process(job);
        } finally {
            AuthContextHolder.clear();
        }
        return true;
    }
}
