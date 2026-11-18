package com.bjjflow.backend.users;

import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import com.bjjflow.backend.realtime.RealtimeHub;
import com.bjjflow.backend.storage.MediaStorage;

import lombok.RequiredArgsConstructor;

/**
 * Tells everyone who might be showing a member's picture that it changed, so
 * their open apps swap it at once instead of on the next refresh. Sent after
 * the change commits, to the member's own other devices and to the people who
 * see them: followers, their gym, conversation partners and match opponents.
 * Each app patches the member's picture into whatever it has on screen.
 */
@Component
@RequiredArgsConstructor
public class PersonEvents {

    /** An upper bound on recipients for one change. */
    static final int MAX_RECIPIENTS = 3000;

    private final JdbcTemplate jdbc;
    private final RealtimeHub realtimeHub;
    private final MediaStorage mediaStorage;
    private final UserRepository userRepository;

    public void pictureChanged(Long userId) {
        User u = userRepository.findById(userId).orElse(null);
        if (u == null) {
            return;
        }
        Map<String, Object> event = new HashMap<>();
        event.put("type", "person");
        event.put("userId", userId);
        event.put("displayName", u.getDisplayName());
        event.put("username", u.getUsername());
        event.put("avatarUrl", u.getAvatarKey() == null ? null : mediaStorage.urlFor(u.getAvatarKey()));
        event.put("bannerUrl", u.getBannerKey() == null ? null : mediaStorage.urlFor(u.getBannerKey()));
        for (Long recipient : audience(userId)) {
            realtimeHub.publishAfterCommit(recipient, event);
        }
    }

    /** The member and the people whose screens show them. */
    Set<Long> audience(Long userId) {
        Set<Long> out = new LinkedHashSet<>();
        out.add(userId);
        List<Long> ids = jdbc.queryForList("""
                SELECT follower_id FROM user_follows WHERE following_id = ?
                UNION SELECT following_id FROM user_follows WHERE follower_id = ?
                UNION SELECT m2.user_id FROM gym_members m1 JOIN gym_members m2 ON m2.gym_id = m1.gym_id
                      WHERE m1.user_id = ?
                UNION SELECT CASE WHEN user_a_id = ? THEN user_b_id ELSE user_a_id END FROM conversations
                      WHERE user_a_id = ? OR user_b_id = ?
                UNION SELECT CASE WHEN challenger_id = ? THEN opponent_id ELSE challenger_id END FROM matches
                      WHERE challenger_id = ? OR opponent_id = ?
                """, Long.class, userId, userId, userId, userId, userId, userId, userId, userId, userId);
        for (Long id : ids) {
            if (out.size() >= MAX_RECIPIENTS) {
                break;
            }
            if (id != null) {
                out.add(id);
            }
        }
        return out;
    }
}
