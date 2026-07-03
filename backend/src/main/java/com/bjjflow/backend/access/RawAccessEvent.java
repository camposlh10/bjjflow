package com.bjjflow.backend.access;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "raw_access_events")
@Getter
@Setter
@NoArgsConstructor
public class RawAccessEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "gym_id", nullable = false)
    private Long gymId;

    @Column(name = "device_id", nullable = false)
    private Long deviceId;

    @Column(name = "student_user_id")
    private Long studentUserId;

    @Column(name = "external_member_id")
    private String externalMemberId;

    @Column(name = "event_time", nullable = false)
    private Instant eventTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AccessEventSource source;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AccessEventStatus status = AccessEventStatus.RECEIVED;

    @Column(nullable = false)
    private Boolean processed = false;

    @Column(name = "processed_at")
    private Instant processedAt;

    @Column(name = "matched_class_id")
    private Long matchedClassId;

    private String notes;
}
