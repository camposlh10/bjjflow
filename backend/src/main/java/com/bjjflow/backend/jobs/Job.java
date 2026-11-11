package com.bjjflow.backend.jobs;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One unit of background work. See {@link JobQueue}. */
@Entity
@Table(name = "jobs")
@Getter
@Setter
@NoArgsConstructor
public class Job {

    public static final String PENDING = "PENDING";
    public static final String RUNNING = "RUNNING";
    public static final String DONE = "DONE";
    public static final String FAILED = "FAILED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String type;

    private String payload;

    private String status = PENDING;

    private Integer attempts = 0;

    @Column(name = "max_attempts")
    private Integer maxAttempts;

    @Column(name = "run_at")
    private Instant runAt;

    @Column(name = "locked_until")
    private Instant lockedUntil;

    @Column(name = "last_error")
    private String lastError;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (runAt == null) {
            runAt = createdAt;
        }
    }
}
