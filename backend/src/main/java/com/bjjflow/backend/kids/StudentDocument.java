package com.bjjflow.backend.kids;

import java.time.Instant;
import java.time.LocalDate;

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

/** A document a guardian signed for a child, recorded by staff. */
@Entity
@Table(name = "student_documents")
@Getter
@Setter
@NoArgsConstructor
public class StudentDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "gym_id")
    private Long gymId;

    @Column(name = "student_user_id")
    private Long studentUserId;

    @Column(name = "document_type_id")
    private Long documentTypeId;

    @Column(name = "signed_by_name")
    private String signedByName;

    @Column(name = "signed_on")
    private LocalDate signedOn;

    @Column(name = "expires_on")
    private LocalDate expiresOn;

    @Column(name = "recorded_by_user_id")
    private Long recordedByUserId;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
