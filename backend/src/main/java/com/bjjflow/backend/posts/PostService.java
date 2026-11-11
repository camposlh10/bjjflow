package com.bjjflow.backend.posts;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.gyms.GymDtos.BeltSummary;
import com.bjjflow.backend.gyms.Gym;
import com.bjjflow.backend.gyms.GymMember;
import com.bjjflow.backend.gyms.GymMemberRepository;
import com.bjjflow.backend.gyms.GymRepository;
import com.bjjflow.backend.gyms.GymRole;
import com.bjjflow.backend.posts.PostDtos.AuthorDto;
import com.bjjflow.backend.posts.PostDtos.CommentDto;
import com.bjjflow.backend.posts.PostDtos.LikeResponse;
import com.bjjflow.backend.posts.PostDtos.MediaDto;
import com.bjjflow.backend.posts.PostDtos.MediaInput;
import com.bjjflow.backend.posts.PostDtos.PostDto;
import com.bjjflow.backend.posts.PostDtos.SaveResponse;
import com.bjjflow.backend.posts.PostDtos.ShareResponse;
import com.bjjflow.backend.posts.PostDtos.UploadResponse;
import com.bjjflow.backend.storage.MediaStorage;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserBeltProgress;
import com.bjjflow.backend.users.UserBeltProgressRepository;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PostService {

    private final GymPostRepository postRepository;
    private final GymPostLikeRepository likeRepository;
    private final GymPostCommentRepository commentRepository;
    private final GymPostMediaRepository mediaRepository;
    private final GymPostSaveRepository saveRepository;
    private final GymMemberRepository gymMemberRepository;
    private final GymRepository gymRepository;
    private final UserRepository userRepository;
    private final UserBeltProgressRepository beltProgressRepository;
    private static final int LEGACY_FEED_LIMIT = 100;
    private static final int MAX_COMMENTS = 200;

    private final MediaStorage mediaStorage;
    private final com.bjjflow.backend.notifications.NotificationService notificationService;

    @Transactional
    public UploadResponse uploadMedia(Long userId, MultipartFile file) {
        requireMembership(userId);
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "EMPTY_FILE", "No file uploaded");
        }
        String contentType = file.getContentType();
        MediaType type;
        if (contentType != null && contentType.startsWith("image/")) {
            type = MediaType.IMAGE;
        } else if (contentType != null && contentType.startsWith("video/")) {
            type = MediaType.VIDEO;
        } else {
            throw new ApiException(HttpStatus.BAD_REQUEST, "UNSUPPORTED_MEDIA",
                    "Only images and videos are allowed");
        }
        String key;
        try (java.io.InputStream in = file.getInputStream()) {
            key = mediaStorage.store(in, file.getSize(), contentType, file.getOriginalFilename());
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "UPLOAD_FAILED", "Could not read upload");
        }
        return new UploadResponse(key, mediaStorage.urlFor(key), type.name());
    }

    @Transactional
    public PostDto createPost(Long userId, String content, List<MediaInput> media) {
        GymMember membership = requireMembership(userId);
        // Per-gym rule: when "instructors only" is on, members can't post to the Mural.
        Gym gym = gymRepository.findById(membership.getGymId()).orElseThrow();
        if (Boolean.TRUE.equals(gym.getInstructorsOnlyPosts()) && membership.getRole() == GymRole.MEMBER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "INSTRUCTORS_ONLY",
                    "Only instructors can post in this gym");
        }

        String text = content == null ? "" : content.trim();
        List<MediaInput> attachments = media == null ? List.of() : media;
        if (text.isEmpty() && attachments.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "EMPTY_POST", "A post needs text or media");
        }

        GymPost post = new GymPost();
        post.setGymId(membership.getGymId());
        post.setAuthorUserId(userId);
        post.setContent(text);
        post = postRepository.save(post);

        int position = 0;
        for (MediaInput input : attachments) {
            GymPostMedia m = new GymPostMedia();
            m.setPostId(post.getId());
            m.setStorageKey(input.key());
            m.setMediaType(parseMediaType(input.type()));
            m.setPosition(position++);
            mediaRepository.save(m);
        }

        // A staff post is a gym announcement -> notify the other members.
        if (membership.getRole() != GymRole.MEMBER) {
            String author = userRepository.findById(userId).map(x -> x.getDisplayName()).orElse("Professor");
            String preview = text.isEmpty()
                    ? "compartilhou algo no Mural."
                    : "postou no Mural: " + (text.length() > 80 ? text.substring(0, 77) + "…" : text);
            List<Long> recipients = gymMemberRepository.findAllByGymId(membership.getGymId()).stream()
                    .map(GymMember::getUserId)
                    .filter(memberId -> !memberId.equals(userId))
                    .toList();
            // Background fan-out: publishing doesn't wait on notifying the whole gym.
            notificationService.notifyMany(recipients, com.bjjflow.backend.notifications.NotificationType.ACADEMY,
                    author, preview, "gym:" + membership.getGymId());
        }
        return toPostDto(post, userId);
    }

    /** Unpaged wall for app builds that predate paging: the most recent posts only. */
    @Transactional(readOnly = true)
    public List<PostDto> feed(Long userId) {
        GymMember membership = requireMembership(userId);
        return buildPostDtos(
                postRepository.findAllByGymIdOrderByPinnedDescCreatedAtDesc(membership.getGymId(),
                        org.springframework.data.domain.PageRequest.of(0, LEGACY_FEED_LIMIT)),
                userId, membership.getGymId());
    }

    /**
     * Cursor-paged wall, newest first. The first page (no cursor) starts with
     * every pinned post; later pages continue through the unpinned ones.
     */
    @Transactional(readOnly = true)
    public PostDtos.PostPage feedPage(Long userId, Long cursor, int limit) {
        GymMember membership = requireMembership(userId);
        Long gymId = membership.getGymId();
        var pageable = org.springframework.data.domain.PageRequest.of(0, limit);
        List<GymPost> unpinned = cursor == null
                ? postRepository.findByGymIdAndPinnedFalseOrderByIdDesc(gymId, pageable)
                : postRepository.findByGymIdAndPinnedFalseAndIdLessThanOrderByIdDesc(gymId, cursor, pageable);
        List<GymPost> posts = new ArrayList<>();
        if (cursor == null) {
            posts.addAll(postRepository.findByGymIdAndPinnedTrueOrderByIdDesc(gymId));
        }
        posts.addAll(unpinned);
        Long nextCursor = unpinned.size() == limit ? unpinned.get(unpinned.size() - 1).getId() : null;
        return new PostDtos.PostPage(buildPostDtos(posts, userId, gymId), nextCursor);
    }

    @Transactional(readOnly = true)
    public PostDto getPost(Long userId, Long postId) {
        GymMember membership = requireMembership(userId);
        return toPostDto(postInGym(postId, membership.getGymId()), userId);
    }

    @Transactional
    public LikeResponse toggleLike(Long userId, Long postId) {
        GymMember membership = requireMembership(userId);
        GymPost post = postInGym(postId, membership.getGymId());
        boolean liked;
        if (likeRepository.existsByPostIdAndUserId(post.getId(), userId)) {
            likeRepository.deleteByPostIdAndUserId(post.getId(), userId);
            liked = false;
        } else {
            GymPostLike like = new GymPostLike();
            like.setPostId(post.getId());
            like.setUserId(userId);
            likeRepository.save(like);
            liked = true;
        }
        return new LikeResponse(liked, likeRepository.countByPostId(post.getId()));
    }

    @Transactional
    public ShareResponse share(Long userId, Long postId) {
        GymMember membership = requireMembership(userId);
        GymPost post = postInGym(postId, membership.getGymId());
        post.setShareCount(post.getShareCount() + 1);
        postRepository.save(post);
        return new ShareResponse(post.getShareCount());
    }

    @Transactional
    public SaveResponse toggleSave(Long userId, Long postId) {
        GymMember membership = requireMembership(userId);
        GymPost post = postInGym(postId, membership.getGymId());
        boolean saved;
        if (saveRepository.existsByPostIdAndUserId(post.getId(), userId)) {
            saveRepository.deleteByPostIdAndUserId(post.getId(), userId);
            saved = false;
        } else {
            GymPostSave save = new GymPostSave();
            save.setPostId(post.getId());
            save.setUserId(userId);
            saveRepository.save(save);
            saved = true;
        }
        return new SaveResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<PostDto> savedPosts(Long userId) {
        GymMember membership = requireMembership(userId);
        List<Long> savedIds = saveRepository.findAllByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(GymPostSave::getPostId)
                .toList();
        if (savedIds.isEmpty()) {
            return List.of();
        }
        // one batched fetch, then restore the saved-at ordering
        Map<Long, GymPost> byId = new HashMap<>();
        for (GymPost p : postRepository.findAllById(savedIds)) {
            if (p.getGymId().equals(membership.getGymId())) {
                byId.put(p.getId(), p);
            }
        }
        List<GymPost> ordered = savedIds.stream().map(byId::get).filter(p -> p != null).toList();
        return buildPostDtos(ordered, userId, membership.getGymId());
    }

    @Transactional
    public CommentDto addComment(Long userId, Long postId, String content) {
        GymMember membership = requireMembership(userId);
        GymPost post = postInGym(postId, membership.getGymId());
        GymPostComment comment = new GymPostComment();
        comment.setPostId(post.getId());
        comment.setUserId(userId);
        comment.setContent(content.trim());
        comment = commentRepository.save(comment);
        AuthorDto author = authorMap(membership.getGymId(), Set.of(userId))
                .getOrDefault(userId, fallbackAuthor(userId));
        return new CommentDto(comment.getId(), author, comment.getContent(), comment.getCreatedAt());
    }

    @Transactional(readOnly = true)
    public List<CommentDto> listComments(Long userId, Long postId) {
        GymMember membership = requireMembership(userId);
        GymPost post = postInGym(postId, membership.getGymId());
        // Most recent comments only, shown oldest-first.
        List<GymPostComment> comments = new ArrayList<>(commentRepository.findByPostIdOrderByIdDesc(post.getId(),
                org.springframework.data.domain.PageRequest.of(0, MAX_COMMENTS)));
        java.util.Collections.reverse(comments);
        Map<Long, AuthorDto> authors = authorMap(membership.getGymId(),
                comments.stream().map(GymPostComment::getUserId).collect(Collectors.toSet()));
        return comments.stream()
                .map(c -> new CommentDto(c.getId(),
                        authors.getOrDefault(c.getUserId(), fallbackAuthor(c.getUserId())),
                        c.getContent(), c.getCreatedAt()))
                .toList();
    }

    @Transactional
    public PostDto setPinned(Long userId, Long postId, boolean pinned) {
        GymMember membership = requireMembership(userId);
        requireStaff(membership);
        GymPost post = postInGym(postId, membership.getGymId());
        post.setPinned(pinned);
        postRepository.save(post);
        return toPostDto(post, userId);
    }

    @Transactional
    public void deletePost(Long userId, Long postId) {
        GymMember membership = requireMembership(userId);
        GymPost post = postInGym(postId, membership.getGymId());
        boolean isAuthor = post.getAuthorUserId().equals(userId);
        boolean isOwner = membership.getRole() == GymRole.OWNER;
        if (!isAuthor && !isOwner) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_ALLOWED",
                    "Only the author or the gym owner can delete this post");
        }
        commentRepository.deleteByPostId(post.getId());
        likeRepository.deleteByPostId(post.getId());
        mediaRepository.deleteByPostId(post.getId());
        saveRepository.deleteByPostId(post.getId());
        postRepository.delete(post);
    }

    private GymMember requireMembership(Long userId) {
        return gymMemberRepository.findFirstByUserId(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NO_GYM", "You are not in a gym"));
    }

    private void requireStaff(GymMember membership) {
        if (membership.getRole() == GymRole.MEMBER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_STAFF", "Only instructors can do this");
        }
    }

    private GymPost postInGym(Long postId, Long gymId) {
        GymPost post = postRepository.findById(postId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "Post not found"));
        if (!post.getGymId().equals(gymId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "Post not found");
        }
        return post;
    }

    private MediaType parseMediaType(String type) {
        try {
            return MediaType.valueOf(type.trim().toUpperCase());
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_MEDIA_TYPE", "Unknown media type");
        }
    }

    /**
     * Builds DTOs for a list of posts with a fixed number of queries (media,
     * like counts, comment counts, my likes/saves, authors), instead of ~7
     * queries per post.
     */
    private List<PostDto> buildPostDtos(List<GymPost> posts, Long requesterId, Long gymId) {
        if (posts.isEmpty()) {
            return List.of();
        }
        List<Long> ids = posts.stream().map(GymPost::getId).toList();

        Map<Long, List<MediaDto>> media = new HashMap<>();
        for (GymPostMedia m : mediaRepository.findAllByPostIdInOrderByPositionAsc(ids)) {
            media.computeIfAbsent(m.getPostId(), k -> new ArrayList<>())
                    .add(new MediaDto(mediaStorage.urlFor(m.getStorageKey()), m.getMediaType().name()));
        }
        Map<Long, Long> likeCounts = new HashMap<>();
        for (Object[] row : likeRepository.countByPostIds(ids)) {
            likeCounts.put((Long) row[0], (Long) row[1]);
        }
        Map<Long, Long> commentCounts = new HashMap<>();
        for (Object[] row : commentRepository.countByPostIds(ids)) {
            commentCounts.put((Long) row[0], (Long) row[1]);
        }
        Set<Long> liked = new HashSet<>(likeRepository.likedPostIds(requesterId, ids));
        Set<Long> saved = new HashSet<>(saveRepository.savedPostIds(requesterId, ids));
        Map<Long, AuthorDto> authors = authorMap(gymId,
                posts.stream().map(GymPost::getAuthorUserId).collect(Collectors.toSet()));

        List<PostDto> out = new ArrayList<>(posts.size());
        for (GymPost post : posts) {
            out.add(new PostDto(
                    post.getId(),
                    authors.getOrDefault(post.getAuthorUserId(), fallbackAuthor(post.getAuthorUserId())),
                    post.getContent(),
                    media.getOrDefault(post.getId(), List.of()),
                    Boolean.TRUE.equals(post.getPinned()),
                    likeCounts.getOrDefault(post.getId(), 0L),
                    commentCounts.getOrDefault(post.getId(), 0L),
                    post.getShareCount(),
                    liked.contains(post.getId()),
                    saved.contains(post.getId()),
                    post.getCreatedAt()));
        }
        return out;
    }

    private PostDto toPostDto(GymPost post, Long requesterId) {
        return buildPostDtos(List.of(post), requesterId, post.getGymId()).get(0);
    }

    private Map<Long, AuthorDto> authorMap(Long gymId, Collection<Long> userIds) {
        if (userIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, String> names = new HashMap<>();
        for (User u : userRepository.findAllById(userIds)) {
            names.put(u.getId(), u.getDisplayName());
        }
        Map<Long, BeltSummary> belts = new HashMap<>();
        for (UserBeltProgress p : beltProgressRepository.findAllByUserIdIn(userIds)) {
            belts.put(p.getUserId(), toBeltSummary(p));
        }
        Map<Long, String> roles = new HashMap<>();
        for (GymMember m : gymMemberRepository.findAllByGymIdAndUserIdIn(gymId, userIds)) {
            roles.put(m.getUserId(), m.getRole().name());
        }
        Map<Long, AuthorDto> out = new HashMap<>();
        for (Long id : userIds) {
            out.put(id, new AuthorDto(id, names.getOrDefault(id, "—"),
                    roles.getOrDefault(id, GymRole.MEMBER.name()), belts.get(id)));
        }
        return out;
    }

    private AuthorDto fallbackAuthor(Long userId) {
        return new AuthorDto(userId, "—", GymRole.MEMBER.name(), null);
    }

    private BeltSummary toBeltSummary(UserBeltProgress progress) {
        var rank = progress.getBeltRank();
        return new BeltSummary(rank.getSlug(), rank.getNamePt(), rank.getColorHex(), progress.getStripes());
    }
}
