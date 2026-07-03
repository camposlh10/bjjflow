package com.bjjflow.backend.users;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String email;

    @Column(name = "password_hash")
    private String passwordHash;

    @Column(name = "display_name")
    private String displayName;

    @Column(name = "first_name")
    private String firstName;

    @Column(name = "last_name")
    private String lastName;

    private String username;

    private Integer age;

    private String gender;

    @Column(name = "favorite_art")
    private String favoriteArt;

    @Column(name = "training_start_year")
    private Integer trainingStartYear;

    @Column(name = "weight_kg", precision = 5, scale = 2)
    private BigDecimal weightKg;

    @Column(name = "height_cm")
    private Integer heightCm;

    @Column(name = "current_streak")
    private Integer currentStreak = 0;

    @Column(name = "longest_streak")
    private Integer longestStreak = 0;

    @Column(name = "last_check_in_date")
    private LocalDate lastCheckInDate;

    @Column(name = "weekly_goal")
    private Integer weeklyGoal = 3;

    private String city;

    private String country;

    private String state;

    private Boolean pro = false;

    @Column(name = "avatar_key")
    private String avatarKey;

    private String bio;

    @Column(name = "certificate_key")
    private String certificateKey;

    @Column(name = "accent_color")
    private String accentColor;

    @Column(name = "banner_key")
    private String bannerKey;

    @Column(name = "is_bot")
    private Boolean bot = false;

    @Column(name = "private_account")
    private Boolean privateAccount = false;

    @Column(name = "notify_community")
    private Boolean notifyCommunity = true;

    @Column(name = "notify_messages")
    private Boolean notifyMessages = true;

    @Column(name = "notify_promotions")
    private Boolean notifyPromotions = true;

    @Column(name = "gym_belt_sync")
    private Boolean gymBeltSync = true;

    @Column(name = "mfa_enabled")
    private Boolean mfaEnabled = false;

    @Column(name = "totp_secret")
    private String totpSecret;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
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
