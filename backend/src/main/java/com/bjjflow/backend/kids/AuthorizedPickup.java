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

/** Someone besides the guardians who may collect a child, or (blocked) who must not. */
@Entity
@Table(name = "authorized_pickups")
@Getter
@Setter
@NoArgsConstructor
public class AuthorizedPickup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "gym_id")
    private Long gymId;

    @Column(name = "student_user_id")
    private Long studentUserId;

    private String name;

    private String relationship;

    private String phone;

    private String notes;

    private Boolean blocked = false;

    @Column(name = "created_by_user_id")
    private Long createdByUserId;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
