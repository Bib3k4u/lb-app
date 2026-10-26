package com.limitbeyond.shared.jobs;

import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * ADR-09: deferred work runs off a Postgres-backed queue. No Redis, no SQS —
 * the database already running comfortably handles the actual workload
 * (notification dispatch, streak recalculation — thousands of jobs a day,
 * not millions an hour).
 *
 * <p>{@link #enqueue} is called from inside the SAME transaction as the
 * business change that triggers the job, so a rollback removes the job too
 * (no orphaned "streak recalculated" for a check-in that never happened).
 * This is also why it uses raw JdbcTemplate rather than a JPA repository —
 * either works transactionally here, but this keeps job payloads as plain
 * JSON text rather than inventing an entity for a table with no interesting
 * relationships.
 */
@Component
public class JobQueueService {

    private final JdbcTemplate jdbc;

    public JobQueueService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Enqueues {@code jobType} with a JSON payload, to run inside the caller's transaction. */
    public void enqueue(String jobType, Map<String, Object> payloadFields) {
        jdbc.update(
                "INSERT INTO job_queue (job_type, payload) VALUES (?, ?::jsonb)",
                jobType, toJson(payloadFields));
    }

    /** Same as {@link #enqueue}, but not claimable until {@code delay} has passed. */
    public void enqueue(String jobType, Map<String, Object> payloadFields, java.time.Duration delay) {
        jdbc.update(
                "INSERT INTO job_queue (job_type, payload, run_after) "
                        + "VALUES (?, ?::jsonb, now() + (? * interval '1 second'))",
                jobType, toJson(payloadFields), delay.toSeconds());
    }

    private static String toJson(Map<String, Object> fields) {
        // A tiny hand-rolled encoder rather than pulling Jackson into this one
        // call site: payloads here are flat string/uuid maps (job type ->
        // ids), never nested structures, so this stays simple and dependency-free.
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (var entry : fields.entrySet()) {
            if (!first) {
                sb.append(',');
            }
            first = false;
            sb.append('"').append(escape(entry.getKey())).append("\":");
            Object v = entry.getValue();
            sb.append(v == null ? "null" : '"' + escape(v.toString()) + '"');
        }
        return sb.append('}').toString();
    }

    private static String escape(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
