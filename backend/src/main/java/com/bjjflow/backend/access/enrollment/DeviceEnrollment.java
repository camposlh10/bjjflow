package com.bjjflow.backend.access.enrollment;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A member registered (or being registered / removed) on one access device. */
@Entity
@Table(name = "device_enrollments")
@Getter
@Setter
@NoArgsConstructor
public class DeviceEnrollment {

    public enum Method {
        FACE,
        CARD
    }

    public enum Status {
        /** Sent to the bridge; for FACE, waiting for the member at the device. */
        PENDING,
        ENROLLED,
        FAILED,
        /** Removal sent to the bridge. */
        REMOVING,
        REMOVED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "gym_id", nullable = false)
    private Long gymId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "device_id", nullable = false)
    private Long deviceId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Method method;

    @Column(name = "card_value")
    private String cardValue;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status;

    /** The bridge command currently carrying this enrollment or its removal. */
    @Column(name = "command_id")
    private Long commandId;

    @Column(name = "last_error")
    private String lastError;

    @Column(name = "created_by_user_id", nullable = false)
    private Long createdByUserId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
