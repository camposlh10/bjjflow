package com.bjjflow.backend.gyms;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "gym_verification_media")
@Getter
@Setter
@NoArgsConstructor
public class GymVerificationMedia {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "verification_id")
    private Long verificationId;

    @Column(name = "storage_key")
    private String storageKey;

    /** CERTIFICATE or ESTABLISHMENT */
    private String kind;

    private Integer position;
}
