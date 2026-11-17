package com.bjjflow.backend.compete;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.compete.CompeteDtos.MatchDto;
import com.bjjflow.backend.compete.CompeteDtos.MatchPostDto;
import com.bjjflow.backend.compete.CompeteDtos.PlayerDto;
import com.bjjflow.backend.notifications.NotificationService;
import com.bjjflow.backend.notifications.NotificationType;
import com.bjjflow.backend.social.FollowRepository;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * Finished matches shared to Comunidade. A player posts their result once; anyone
 * can repost a post once (a repost of a repost points at the original). Nothing is
 * posted automatically, so nobody's loss goes out without them choosing it.
 */
@Service
@RequiredArgsConstructor
public class MatchPostService {

    public static final String SCOPE_ALL = "all";
    private static final Duration WINDOW = Duration.ofDays(30);
    private static final int LIMIT = 30;

    private final MatchPostRepository postRepository;
    private final MatchRepository matchRepository;
    private final MatchService matchService;
    private final FollowRepository followRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final Players players;

    @Transactional
    public MatchPostDto post(Long me, Long matchId, String caption) {
        Match m = matchService.requireMatch(matchId);
        if (!m.involves(me)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "MATCH_NOT_FOUND", "Match not found");
        }
        if (!Match.FINISHED.equals(m.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "MATCH_NOT_FINISHED", "Only finished matches can be posted");
        }
        MatchPost post = postRepository.findByMatchIdAndUserId(matchId, me).orElse(null);
        if (post == null) {
            post = new MatchPost();
            post.setMatchId(matchId);
            post.setUserId(me);
            post.setCaption(blankToNull(caption));
            post = postRepository.save(post);
        }
        return toDtos(List.of(post), me).get(0);
    }

    @Transactional
    public MatchPostDto repost(Long me, Long postId) {
        MatchPost source = requirePost(postId);
        MatchPost original = source.getRepostOfId() == null ? source : requirePost(source.getRepostOfId());
        MatchPost existing = postRepository.findByMatchIdAndUserId(original.getMatchId(), me).orElse(null);
        if (existing != null) {
            return toDtos(List.of(existing), me).get(0);
        }
        MatchPost repost = new MatchPost();
        repost.setMatchId(original.getMatchId());
        repost.setUserId(me);
        repost.setRepostOfId(original.getId());
        repost = postRepository.save(repost);
        if (!original.getUserId().equals(me)) {
            String name = userRepository.findById(me).map(User::getDisplayName).orElse("Alguém");
            notificationService.notify(original.getUserId(), NotificationType.SOCIAL, name,
                    "repostou o resultado da sua partida", "match:" + original.getMatchId());
        }
        return toDtos(List.of(repost), me).get(0);
    }

    @Transactional
    public void delete(Long me, Long postId) {
        MatchPost post = requirePost(postId);
        if (!post.getUserId().equals(me)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_YOUR_POST", "Only the author can delete this post");
        }
        postRepository.delete(post);
    }

    /** Recent match posts: by people the member follows (and their own), or everyone's with scope "all". */
    @Transactional(readOnly = true)
    public List<MatchPostDto> feed(Long me, String scope) {
        Instant since = Instant.now().minus(WINDOW);
        PageRequest page = PageRequest.of(0, LIMIT);
        List<MatchPost> posts;
        if (SCOPE_ALL.equals(scope)) {
            posts = postRepository.findByCreatedAtAfterOrderByCreatedAtDesc(since, page);
        } else {
            Set<Long> authors = new HashSet<>(followRepository.findFollowingIds(me));
            authors.add(me);
            posts = postRepository.findByUserIdInAndCreatedAtAfterOrderByCreatedAtDesc(authors, since, page);
        }
        // One card per match: the newest share of it (a repost shows who reposted).
        Set<Long> seen = new HashSet<>();
        List<MatchPost> distinct = posts.stream().filter(p -> seen.add(p.getMatchId())).toList();
        return toDtos(distinct, me);
    }

    private List<MatchPostDto> toDtos(List<MatchPost> posts, Long me) {
        if (posts.isEmpty()) {
            return List.of();
        }
        Set<Long> originalIds = new LinkedHashSet<>();
        for (MatchPost p : posts) {
            originalIds.add(p.getRepostOfId() == null ? p.getId() : p.getRepostOfId());
        }
        Map<Long, MatchPost> originals = new HashMap<>();
        postRepository.findAllById(originalIds).forEach(o -> originals.put(o.getId(), o));
        Map<Long, Integer> reposts = new HashMap<>();
        for (Object[] row : postRepository.countReposts(originalIds)) {
            reposts.put((Long) row[0], ((Number) row[1]).intValue());
        }
        Set<Long> userIds = new LinkedHashSet<>();
        Set<Long> matchIds = new LinkedHashSet<>();
        for (MatchPost p : posts) {
            userIds.add(p.getUserId());
            matchIds.add(p.getMatchId());
            MatchPost o = originals.get(p.getRepostOfId());
            if (o != null) {
                userIds.add(o.getUserId());
            }
        }
        Map<Long, PlayerDto> people = players.of(userIds);
        Set<Long> sharedByMe = new HashSet<>(postRepository.matchIdsSharedBy(me, matchIds));
        Map<Long, MatchDto> matches = new HashMap<>();
        for (Match m : matchRepository.findAllById(matchIds)) {
            matches.put(m.getId(), matchService.toDto(m, me, false));
        }

        List<MatchPostDto> out = new ArrayList<>();
        for (MatchPost p : posts) {
            MatchDto match = matches.get(p.getMatchId());
            if (match == null) {
                continue;
            }
            Long originalId = p.getRepostOfId() == null ? p.getId() : p.getRepostOfId();
            MatchPost original = originals.get(p.getRepostOfId());
            out.add(new MatchPostDto(p.getId(), people.get(p.getUserId()),
                    original == null ? null : people.get(original.getUserId()), originalId,
                    original == null ? p.getCaption() : original.getCaption(), p.getCreatedAt(), match,
                    reposts.getOrDefault(originalId, 0), sharedByMe.contains(p.getMatchId())));
        }
        return out;
    }

    private MatchPost requirePost(Long postId) {
        return postRepository.findById(postId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "Post not found"));
    }

    private static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }
}
