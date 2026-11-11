package com.bjjflow.backend.jobs;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * The real queue and worker (not the inline mode the flow tests use). Jobs are
 * committed for real here, so each test uses its own job type.
 */
@SpringBootTest(properties = {
        "app.jobs.inline=false",
        // Keep the scheduled poll out of the way; tests drive the worker directly.
        "app.jobs.poll-interval-ms=3600000" })
@ActiveProfiles("test")
class JobQueueTest {

    /** Counts runs per job key; fails while a key's "failuresLeft" is positive. */
    static final Map<String, AtomicInteger> RUNS = new ConcurrentHashMap<>();
    static final Map<String, AtomicInteger> FAILURES_LEFT = new ConcurrentHashMap<>();

    @TestConfiguration
    static class TestHandlers {
        @Bean
        JobHandler testJobHandler() {
            return new JobHandler() {
                @Override
                public String type() {
                    return "test.count";
                }

                @Override
                public void handle(Map<String, Object> payload) {
                    String key = JobHandler.stringArg(payload, "key");
                    RUNS.computeIfAbsent(key, k -> new AtomicInteger()).incrementAndGet();
                    AtomicInteger failures = FAILURES_LEFT.get(key);
                    if (failures != null && failures.getAndDecrement() > 0) {
                        throw new IllegalStateException("planned failure");
                    }
                }
            };
        }
    }

    @Autowired
    private JobQueue jobQueue;
    @Autowired
    private JobWorker jobWorker;
    @Autowired
    private JobRepository jobRepository;
    @Autowired
    private PlatformTransactionManager transactionManager;

    private TransactionTemplate tx;

    @BeforeEach
    void setUp() {
        tx = new TransactionTemplate(transactionManager);
    }

    private void drain() {
        while (jobWorker.runBatch() > 0) {
            // keep going until nothing is due
        }
    }

    /** Payloads are erased on success, so remember which job id carried which key. */
    private final Map<Long, String> lastKey = new ConcurrentHashMap<>();

    private Long enqueueCommitted(String key, int maxAttempts) {
        return tx.execute(status -> {
            long before = jobRepository.count();
            jobQueue.enqueue("test.count", Map.of("key", key), Duration.ZERO, maxAttempts);
            Job job = jobRepository.findAll().stream()
                    .filter(j -> j.getPayload() != null && j.getPayload().contains("\"" + key + "\""))
                    .findFirst().orElseThrow();
            assertThat(jobRepository.count()).isEqualTo(before + 1);
            lastKey.put(job.getId(), key);
            return job.getId();
        });
    }

    @Test
    void committedJobRunsOnceAndPayloadIsErased() {
        Long id = enqueueCommitted("ok-1", 3);
        drain();

        assertThat(RUNS.get("ok-1").get()).isEqualTo(1);
        Job job = jobRepository.findById(id).orElseThrow();
        assertThat(job.getStatus()).isEqualTo(Job.DONE);
        assertThat(job.getPayload()).isNull();
        assertThat(job.getAttempts()).isEqualTo(1);

        // Nothing left to do: running again does not repeat it.
        drain();
        assertThat(RUNS.get("ok-1").get()).isEqualTo(1);
    }

    @Test
    void jobFromARolledBackTransactionNeverExists() {
        long before = jobRepository.count();
        tx.executeWithoutResult(status -> {
            jobQueue.enqueue("test.count", Map.of("key", "rolled-back"));
            status.setRollbackOnly();
        });
        assertThat(jobRepository.count()).isEqualTo(before);
        drain();
        assertThat(RUNS.get("rolled-back")).isNull();
    }

    @Test
    void failuresAreRetriedWithBackoffThenMarkedFailed() {
        FAILURES_LEFT.put("flaky", new AtomicInteger(99));
        Long id = enqueueCommitted("flaky", 2);

        drain();
        Job afterFirst = jobRepository.findById(id).orElseThrow();
        assertThat(afterFirst.getStatus()).isEqualTo(Job.PENDING);
        assertThat(afterFirst.getAttempts()).isEqualTo(1);
        assertThat(afterFirst.getLastError()).contains("planned failure");
        assertThat(afterFirst.getRunAt()).isAfter(Instant.now().plusSeconds(5));

        // Not due yet: nothing happens.
        drain();
        assertThat(RUNS.get("flaky").get()).isEqualTo(1);

        // Fast-forward to the retry.
        tx.executeWithoutResult(status -> jobRepository.markRetry(id, Instant.now().minusSeconds(1),
                afterFirst.getLastError()));
        drain();
        Job afterSecond = jobRepository.findById(id).orElseThrow();
        assertThat(afterSecond.getStatus()).isEqualTo(Job.FAILED);
        assertThat(afterSecond.getAttempts()).isEqualTo(2);
        assertThat(RUNS.get("flaky").get()).isEqualTo(2);
    }

    @Test
    void retrySucceedsAfterATransientFailure() {
        FAILURES_LEFT.put("transient", new AtomicInteger(1));
        Long id = enqueueCommitted("transient", 5);
        drain();
        tx.executeWithoutResult(status -> jobRepository.markRetry(id, Instant.now().minusSeconds(1), "x"));
        drain();
        assertThat(jobRepository.findById(id).orElseThrow().getStatus()).isEqualTo(Job.DONE);
        assertThat(RUNS.get("transient").get()).isEqualTo(2);
    }

    @Test
    void concurrentWorkersRunEachJobExactlyOnce() throws Exception {
        List<String> keys = java.util.stream.IntStream.range(0, 30).mapToObj(i -> "race-" + i).toList();
        for (String key : keys) {
            enqueueCommitted(key, 3);
        }
        int workers = 4;
        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService pool = Executors.newFixedThreadPool(workers)) {
            for (int w = 0; w < workers; w++) {
                pool.submit(() -> {
                    start.await();
                    drain();
                    return null;
                });
            }
            start.countDown();
        }
        for (String key : keys) {
            assertThat(RUNS.get(key)).as(key).isNotNull();
            assertThat(RUNS.get(key).get()).as(key).isEqualTo(1);
        }
    }

    @Test
    void backoffDoublesAndIsCapped() {
        assertThat(JobWorker.backoff(1)).isEqualTo(Duration.ofSeconds(10));
        assertThat(JobWorker.backoff(2)).isEqualTo(Duration.ofSeconds(20));
        assertThat(JobWorker.backoff(4)).isEqualTo(Duration.ofSeconds(80));
        assertThat(JobWorker.backoff(30)).isEqualTo(Duration.ofHours(1));
    }
}
