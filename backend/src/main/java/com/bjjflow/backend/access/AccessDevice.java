package com.bjjflow.backend.access;

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

@Entity
@Table(name = "access_devices")
@Getter
@Setter
@NoArgsConstructor
public class AccessDevice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "gym_id", nullable = false)
    private Long gymId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String type;

    private String provider;

    private String location;

    @Column(nullable = false)
    private Boolean active = true;

    /** SHA-256 hex of the device API key; the plaintext key is never stored. */
    @Column(name = "api_key_hash")
    private String apiKeyHash;

    @Column(name = "created_at")
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
