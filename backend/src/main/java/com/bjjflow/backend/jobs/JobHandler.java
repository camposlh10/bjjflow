package com.bjjflow.backend.jobs;

import java.util.Map;

/**
 * Runs one job type. Implementations are Spring beans; {@link JobQueue} finds
 * them by {@link #type()}. Throwing means "try again later" (until the job's
 * attempts run out), so handlers must be safe to run more than once.
 */
public interface JobHandler {

    String type();

    void handle(Map<String, Object> payload);

    /**
     * Whether to run inside a database transaction. Handlers that mostly wait on
     * an external service (push, email) say false so they don't hold a
     * connection open during the call.
     */
    default boolean transactional() {
        return true;
    }

    static long longArg(Map<String, Object> payload, String name) {
        return ((Number) payload.get(name)).longValue();
    }

    static String stringArg(Map<String, Object> payload, String name) {
        Object value = payload.get(name);
        return value == null ? null : value.toString();
    }
}
