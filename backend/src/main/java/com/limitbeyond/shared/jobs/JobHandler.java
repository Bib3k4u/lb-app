package com.limitbeyond.shared.jobs;

import java.util.Map;

/**
 * One handler per job type. Implementations live in whichever module owns
 * the job — e.g. {@code attendance.internal.RecalculateStreakJobHandler} —
 * and are discovered automatically: {@link JobWorker} collects every
 * {@code JobHandler} bean into a map keyed by {@link #jobType()}, so adding a
 * new job type is "implement this interface", never a change to the worker.
 */
public interface JobHandler {

    String jobType();

    /** Should be {@code @Transactional} — that is what gives it RLS context
     *  (via {@code JobWorker}'s system-level {@code AuthContext}) and lets a
     *  thrown exception roll back any partial writes before the job is
     *  retried. */
    void handle(Map<String, String> payload);
}
