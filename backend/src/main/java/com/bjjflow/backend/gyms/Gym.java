package com.bjjflow.backend.gyms;

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
@Table(name = "gyms")
@Getter
@Setter
@NoArgsConstructor
public class Gym {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    private String city;

    private String description;

    @Column(name = "invite_code")
    private String inviteCode;

    @Column(name = "graduation_target")
    private Integer graduationTarget = 40;

    @Column(name = "instructors_only_posts")
    private Boolean instructorsOnlyPosts = false;

    @Column(name = "logo_key")
    private String logoKey;

    private String phone;

    private String email;

    private String website;

    private String address;

    private Boolean verified = false;

    private String instagram;

    private String facebook;

    private String whatsapp;

    private String youtube;

    @Column(name = "google_place_id")
    private String googlePlaceId;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
