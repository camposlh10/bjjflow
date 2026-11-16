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

/**
 * A child's guardian, created by the gym. Until the guardian enters the invite
 * code in the app it is PENDING and only holds contact details.
 */
@Entity
@Table(name = "guardianships")
@Getter
@Setter
@NoArgsConstructor
public class Guardianship {

    public static final String PENDING = "PENDING";
    public static final String ACTIVE = "ACTIVE";
    public static final String REVOKED = "REVOKED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "gym_id")
    private Long gymId;

    @Column(name = "student_user_id")
    private Long studentUserId;

    @Column(name = "guardian_user_id")
    private Long guardianUserId;

    private String name;

    /** MOTHER | FATHER | GRANDPARENT | OTHER */
    private String relationship;

    private String phone;

    private String email;

    @Column(name = "primary_contact")
    private Boolean primaryContact;

    @Column(name = "financial_responsible")
    private Boolean financialResponsible;

    private String status = PENDING;

    @Column(name = "invite_code")
    private String inviteCode;

    @Column(name = "invite_expires_at")
    private Instant inviteExpiresAt;

    @Column(name = "linked_at")
    private Instant linkedAt;

    @Column(name = "created_by_user_id")
    private Long createdByUserId;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
