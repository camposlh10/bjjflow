package com.bjjflow.backend.jobs;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Polls the {@code jobs} table and runs due jobs, a batch at a time, each on its
 * own virtual thread. Safe to run on several server instances at once: a job is
 * claimed with a conditional update, so only one instance ever runs it.
 *
 * Failures are retried with exponential backoff (10s, 20s, 40s… capped at an
 * hour) until the job's attempts run out, then it is marked FAILED and kept for
 * inspection.
 */
@Component
@ConditionalOnProperty(name = "app.jobs.inline", havingValue = "false", matchIfMissing = true)
public class JobWorker {

    private static final Logger log = LoggerFactory.getLogger(JobWorker.class);
    private static final int BATCH = 20;
    private static final int MAX_BATCHES_PER_POLL = 10;
    /** How long a claim lasts before another worker may assume this one died. */
    private static final Duration CLAIM = Duration.ofMinutes(5);
    private static final Duration FIRST_RETRY = Duration.ofSeconds(10);
    private static final Duration MAX_RETRY = Duration.ofHours(1);

    private final JobRepository repository;
    private final JobQueue queue;
    private final TransactionTemplate tx;

    public JobWorker(JobRepository repository, JobQueue queue, PlatformTransactionManager transactionManager) {
        this.repository = repository;
        this.queue = queue;
        this.tx = new TransactionTemplate(transactionManager);
    }

    @Scheduled(fixedDelayString = "${app.jobs.poll-interval-ms:1000}", initialDelay = 5000)
    public void poll() {
        for (int batch = 0; batch < MAX_BATCHES_PER_POLL; batch++) {
            if (runBatch() < BATCH) {
                return;
            }
        }
    }

    /** Claims and runs up to one batch of due jobs; returns how many were due. */
    int runBatch() {
        Instant now = Instant.now();
        List<Long> due = repository.findDueIds(now, PageRequest.of(0, BATCH));
        List<Job> claimed = new ArrayList<>();
        for (Long id : due) {
            Integer won = tx.execute(status -> repository.claim(id, now, now.plus(CLAIM)));
            if (won != null && won == 1) {
                repository.findById(id).ifPresent(claimed::add);
            }
        }
        if (!claimed.isEmpty()) {
            try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
                for (Job job : claimed) {
                    executor.submit(() -> runOne(job));
                }
            }
        }
        return due.size();
    }

    private void runOne(Job job) {
        try {
            JobHandler handler = queue.handler(job.getType());
            Map<String, Object> payload = queue.parse(job.getPayload());
            if (handler.transactional()) {
                tx.executeWithoutResult(status -> handler.handle(payload));
            } else {
                handler.handle(payload);
            }
            tx.executeWithoutResult(status -> repository.markDone(job.getId(), Instant.now()));
        } catch (Exception failure) {
            String error = truncate(failure.getClass().getSimpleName() + ": " + failure.getMessage());
            if (job.getAttempts() >= job.getMaxAttempts()) {
                log.error("Job {} ({}) failed for good after {} attempt(s): {}", job.getId(), job.getType(),
                        job.getAttempts(), error);
                tx.executeWithoutResult(status -> repository.markFailed(job.getId(), error, Instant.now()));
            } else {
                Instant retryAt = Instant.now().plus(backoff(job.getAttempts()));
                log.warn("Job {} ({}) attempt {} failed, retrying at {}: {}", job.getId(), job.getType(),
                        job.getAttempts(), retryAt, error);
                tx.executeWithoutResult(status -> repository.markRetry(job.getId(), retryAt, error));
            }
        }
    }

    static Duration backoff(int attempts) {
        Duration delay = FIRST_RETRY.multipliedBy(1L << Math.min(Math.max(attempts - 1, 0), 20));
        return delay.compareTo(MAX_RETRY) > 0 ? MAX_RETRY : delay;
    }

    /** Finished jobs are only kept a week, for troubleshooting. */
    @Scheduled(cron = "0 15 4 * * *")
    public void purgeFinished() {
        Integer purged = tx.execute(status -> repository.purgeDoneBefore(Instant.now().minus(Duration.ofDays(7))));
        if (purged != null && purged > 0) {
            log.info("Purged {} finished job(s)", purged);
        }
    }

    private static String truncate(String text) {
        return text.length() <= 1000 ? text : text.substring(0, 1000);
    }
}
