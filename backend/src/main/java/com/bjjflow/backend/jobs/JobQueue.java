package com.bjjflow.backend.jobs;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * Enqueues background work. A job is a row in the {@code jobs} table written in
 * the caller's transaction (a transactional outbox): if the caller rolls back,
 * the job never existed; once it commits, {@link JobWorker} runs it even across
 * restarts, retrying with backoff.
 *
 * With {@code app.jobs.inline=true} (tests) jobs run immediately in the caller's
 * thread instead, so flows can be asserted without waiting on a worker.
 */
@Service
public class JobQueue {

    static final int DEFAULT_MAX_ATTEMPTS = 6;

    private final JobRepository repository;
    private final ObjectProvider<JobHandler> handlers;
    private final JsonMapper json;
    private final boolean inline;

    public JobQueue(JobRepository repository, ObjectProvider<JobHandler> handlers, JsonMapper json,
            @Value("${app.jobs.inline:false}") boolean inline) {
        this.repository = repository;
        this.handlers = handlers;
        this.json = json;
        this.inline = inline;
    }

    public void enqueue(String type, Map<String, Object> payload) {
        enqueue(type, payload, Duration.ZERO, DEFAULT_MAX_ATTEMPTS);
    }

    public void enqueue(String type, Map<String, Object> payload, Duration delay, int maxAttempts) {
        JobHandler handler = handler(type);
        if (inline) {
            handler.handle(payload);
            return;
        }
        Job job = new Job();
        job.setType(type);
        job.setPayload(json.writeValueAsString(payload));
        job.setMaxAttempts(maxAttempts);
        job.setRunAt(Instant.now().plus(delay));
        repository.save(job);
    }

    JobHandler handler(String type) {
        return handlers.stream()
                .filter(h -> h.type().equals(type))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("No job handler for type " + type));
    }

    Map<String, Object> parse(String payload) {
        if (payload == null || payload.isBlank()) {
            return Map.of();
        }
        return json.readValue(payload, new TypeReference<Map<String, Object>>() {
        });
    }
}
