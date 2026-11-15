package com.bjjflow.backend.access.bridge;

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

/** A BJJ Flow Bridge installed on a gym's front-desk computer. */
@Entity
@Table(name = "access_bridges")
@Getter
@Setter
@NoArgsConstructor
public class AccessBridge {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "gym_id", nullable = false)
    private Long gymId;

    @Column(nullable = false)
    private String name;

    @Column(name = "api_key_hash", nullable = false)
    private String apiKeyHash;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "last_seen_at")
    private Instant lastSeenAt;

    /** Bridge app version, as reported on its last heartbeat. */
    private String version;

    /** Notifications waiting on the bridge to reach the cloud, as of its last heartbeat. */
    @Column(name = "queue_depth")
    private Integer queueDepth;

    /** When the "bridge offline" alert went out; null while it is online. */
    @Column(name = "offline_alerted_at")
    private Instant offlineAlertedAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
