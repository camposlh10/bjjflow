package com.bjjflow.backend.posts;

import java.time.Instant;
import java.util.List;

import com.bjjflow.backend.gyms.GymDtos.BeltSummary;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class PostDtos {

    public record AuthorDto(Long userId, String displayName, String role, BeltSummary belt) {
    }

    public record MediaDto(String url, String type) {
    }

    public record PostDto(
            Long id,
            AuthorDto author,
            String content,
            List<MediaDto> media,
            boolean pinned,
            long likeCount,
            long commentCount,
            int shareCount,
            boolean likedByMe,
            boolean savedByMe,
            Instant createdAt) {
    }

    public record CommentDto(Long id, AuthorDto author, String content, Instant createdAt) {
    }

    /** A media attachment referenced when creating a post (key returned by the upload endpoint). */
    public record MediaInput(@NotBlank String key, @NotBlank String type) {
    }

    public record CreatePostRequest(
            @Size(max = 2000) String content,
            List<MediaInput> media) {
    }

    public record CreateCommentRequest(@NotBlank @Size(max = 1000) String content) {
    }

    public record PinRequest(boolean pinned) {
    }

    public record LikeResponse(boolean liked, long likeCount) {
    }

    public record ShareResponse(int shareCount) {
    }

    public record SaveResponse(boolean saved) {
    }

    public record UploadResponse(String key, String url, String type) {
    }
}
