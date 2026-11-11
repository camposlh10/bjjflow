package com.bjjflow.backend.jobs;

import java.lang.management.ManagementFactory;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Makes a scheduled task run on one server instance only. Every instance's
 * cron fires; the first to push the task's {@code locked_until} forward wins,
 * and the rest skip that run.
 */
@Service
public class SchedulerLocks {

    private static final String INSTANCE = ManagementFactory.getRuntimeMXBean().getName() + "/"
            + UUID.randomUUID().toString().substring(0, 8);

    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;

    public SchedulerLocks(JdbcTemplate jdbc, PlatformTransactionManager transactionManager) {
        this.jdbc = jdbc;
        this.tx = new TransactionTemplate(transactionManager);
    }

    /**
     * True when this instance may run {@code name} now; the lock is then held
     * for {@code hold}. Pick a hold shorter than the task's interval and longer
     * than the clock difference between instances.
     */
    public boolean tryLock(String name, Duration hold) {
        Instant now = Instant.now();
        java.sql.Timestamp nowTs = java.sql.Timestamp.from(now);
        java.sql.Timestamp until = java.sql.Timestamp.from(now.plus(hold));
        Integer updated = tx.execute(status -> jdbc.update(
                "UPDATE scheduler_locks SET locked_until = ?, locked_by = ? WHERE name = ? AND locked_until < ?",
                until, INSTANCE, name, nowTs));
        if (updated != null && updated == 1) {
            return true;
        }
        try {
            Integer inserted = tx.execute(status -> jdbc.update(
                    "INSERT INTO scheduler_locks (name, locked_until, locked_by) "
                            + "SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM scheduler_locks WHERE name = ?)",
                    name, until, INSTANCE, name));
            return inserted != null && inserted == 1;
        } catch (DataIntegrityViolationException raced) {
            // Another instance created the row at the same moment and holds it.
            return false;
        }
    }
}
