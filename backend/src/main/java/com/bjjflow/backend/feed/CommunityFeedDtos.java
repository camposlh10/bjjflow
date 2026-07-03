package com.bjjflow.backend.feed;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.bjjflow.backend.auth.AuthDtos.BeltDto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class CommunityFeedDtos {

    public record FeedAuthorDto(Long id, String username, String displayName, boolean pro, String avatarUrl,
            BeltDto belt) {
    }

    public record FeedSubmissionDto(String submission, String direction, int count) {
    }

    /** One public training session rendered as a Strava-style activity card. */
    public record FeedItemDto(
            Long checkInId,
            FeedAuthorDto author,
            String sessionType,
            Integer durationMinutes,
            LocalDate date,
            Instant createdAt,
            String notes,
            String photoUrl,
            int landed,
            int conceded,
            List<FeedSubmissionDto> submissions,
            long likeCount,
            long commentCount,
            int shareCount,
            boolean likedByMe) {
    }

    /** A page of the feed plus the cursor to fetch the next (older) page (null = end). */
    public record FeedPage(List<FeedItemDto> items, Long nextCursor) {
    }

    public record FeedCommentDto(Long id, FeedAuthorDto author, String content, Instant createdAt) {
    }

    public record CreateCommentRequest(@NotBlank @Size(max = 1000) String content) {
    }

    public record LikeResponse(boolean liked, long likeCount) {
    }

    public record ShareResponse(int shareCount) {
    }
}
