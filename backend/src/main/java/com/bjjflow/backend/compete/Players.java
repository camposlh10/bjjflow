package com.bjjflow.backend.compete;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.bjjflow.backend.compete.CompeteDtos.PlayerDto;
import com.bjjflow.backend.feed.CommunityFeedDtos.FeedAuthorDto;
import com.bjjflow.backend.feed.CommunityFeedService;

import lombok.RequiredArgsConstructor;

/** Builds {@link PlayerDto}s (public profile plus rating) for many members at once. */
@Component
@RequiredArgsConstructor
class Players {

    private final CommunityFeedService communityFeedService;
    private final RatingService ratingService;

    Map<Long, PlayerDto> of(Collection<Long> userIds) {
        Map<Long, FeedAuthorDto> authors = communityFeedService.authorMap(userIds);
        Map<Long, Integer> ratings = ratingService.ratings(userIds);
        Map<Long, PlayerDto> out = new LinkedHashMap<>();
        for (Long id : userIds) {
            FeedAuthorDto a = authors.get(id);
            int rating = ratings.getOrDefault(id, Compete.START_RATING);
            out.put(id, a == null
                    ? new PlayerDto(id, null, "—", null, null, rating)
                    : new PlayerDto(id, a.username(), a.displayName(), a.avatarUrl(), a.belt(), rating));
        }
        return out;
    }
}
