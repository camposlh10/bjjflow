package com.bjjflow.backend.kids;

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

/** A document the gym collects from families (waiver, medical form...). */
@Entity
@Table(name = "gym_document_types")
@Getter
@Setter
@NoArgsConstructor
public class DocumentType {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "gym_id")
    private Long gymId;

    private String name;

    /** WAIVER | MEDICAL | IMAGE_CONSENT | OTHER */
    private String kind;

    private Boolean required;

    /** Months until it must be signed again; null when it never expires. */
    @Column(name = "renewal_months")
    private Integer renewalMonths;

    private Boolean active = true;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
