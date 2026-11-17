package com.bjjflow.backend.compete;

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

/** A finished match shared to Comunidade by a player, or reposted by anyone (repostOfId set). */
@Entity
@Table(name = "match_posts")
@Getter
@Setter
@NoArgsConstructor
public class MatchPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "match_id")
    private Long matchId;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "repost_of_id")
    private Long repostOfId;

    private String caption;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
