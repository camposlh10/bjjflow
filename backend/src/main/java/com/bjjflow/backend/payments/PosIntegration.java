package com.bjjflow.backend.payments;

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

/**
 * A registered card machine / payment gateway account. Webhooks authenticate
 * with the integration's API key (stored as SHA-256 hash, like access devices).
 */
@Entity
@Table(name = "pos_integrations")
@Getter
@Setter
@NoArgsConstructor
public class PosIntegration {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "gym_id", nullable = false)
    private Long gymId;

    @Column(nullable = false)
    private String name;

    @Column(name = "provider_name", nullable = false)
    private String providerName;

    @Column(name = "api_key_hash")
    private String apiKeyHash;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "last_seen_at")
    private Instant lastSeenAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
