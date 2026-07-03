package com.bjjflow.backend.feed;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.feed.CommunityFeedDtos.CreateCommentRequest;
import com.bjjflow.backend.feed.CommunityFeedDtos.FeedCommentDto;
import com.bjjflow.backend.feed.CommunityFeedDtos.FeedPage;
import com.bjjflow.backend.feed.CommunityFeedDtos.LikeResponse;
import com.bjjflow.backend.feed.CommunityFeedDtos.ShareResponse;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/feed")
@RequiredArgsConstructor
public class CommunityFeedController {

    private final CommunityFeedService feedService;

    private static Long userId(Authentication auth) {
        return Long.parseLong(auth.getName());
    }

    /** Global Comunidade feed: newest public sessions, cursor-paginated (pass the
     *  previous page's nextCursor to load older items). */
    @GetMapping
    public FeedPage feed(Authentication auth,
            @RequestParam(required = false) Long cursor,
            @RequestParam(defaultValue = "20") int limit) {
        int capped = Math.min(Math.max(limit, 1), 50);
        return feedService.feed(userId(auth), cursor, capped);
    }

    @PostMapping("/{id}/like")
    public LikeResponse like(Authentication auth, @PathVariable Long id) {
        return feedService.toggleLike(userId(auth), id);
    }

    @PostMapping("/{id}/share")
    public ShareResponse share(Authentication auth, @PathVariable Long id) {
        return feedService.share(userId(auth), id);
    }

    @GetMapping("/{id}/comments")
    public List<FeedCommentDto> comments(@PathVariable Long id) {
        return feedService.listComments(id);
    }

    @PostMapping("/{id}/comments")
    public FeedCommentDto comment(Authentication auth, @PathVariable Long id,
            @Valid @RequestBody CreateCommentRequest request) {
        return feedService.addComment(userId(auth), id, request.content());
    }
}
