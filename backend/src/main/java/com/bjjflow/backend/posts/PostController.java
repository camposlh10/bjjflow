package com.bjjflow.backend.posts;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.bjjflow.backend.posts.PostDtos.CommentDto;
import com.bjjflow.backend.posts.PostDtos.CreateCommentRequest;
import com.bjjflow.backend.posts.PostDtos.CreatePostRequest;
import com.bjjflow.backend.posts.PostDtos.LikeResponse;
import com.bjjflow.backend.posts.PostDtos.PinRequest;
import com.bjjflow.backend.posts.PostDtos.PostDto;
import com.bjjflow.backend.posts.PostDtos.SaveResponse;
import com.bjjflow.backend.posts.PostDtos.ShareResponse;
import com.bjjflow.backend.posts.PostDtos.UploadResponse;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/gyms/posts")
@RequiredArgsConstructor
public class PostController {

    private final PostService postService;

    private static Long userId(Authentication auth) {
        return Long.parseLong(auth.getName());
    }

    @GetMapping
    public List<PostDto> feed(Authentication auth) {
        return postService.feed(userId(auth));
    }

    @GetMapping("/saved")
    public List<PostDto> saved(Authentication auth) {
        return postService.savedPosts(userId(auth));
    }

    @PostMapping
    public PostDto create(Authentication auth, @Valid @RequestBody CreatePostRequest request) {
        return postService.createPost(userId(auth), request.content(), request.media());
    }

    @GetMapping("/{id}")
    public PostDto getPost(Authentication auth, @PathVariable Long id) {
        return postService.getPost(userId(auth), id);
    }

    @PostMapping(value = "/media", consumes = "multipart/form-data")
    public UploadResponse uploadMedia(Authentication auth, @RequestParam("file") MultipartFile file) {
        return postService.uploadMedia(userId(auth), file);
    }

    @DeleteMapping("/{id}")
    public void delete(Authentication auth, @PathVariable Long id) {
        postService.deletePost(userId(auth), id);
    }

    @PostMapping("/{id}/like")
    public LikeResponse like(Authentication auth, @PathVariable Long id) {
        return postService.toggleLike(userId(auth), id);
    }

    @PostMapping("/{id}/share")
    public ShareResponse share(Authentication auth, @PathVariable Long id) {
        return postService.share(userId(auth), id);
    }

    @PostMapping("/{id}/save")
    public SaveResponse save(Authentication auth, @PathVariable Long id) {
        return postService.toggleSave(userId(auth), id);
    }

    @PutMapping("/{id}/pin")
    public PostDto pin(Authentication auth, @PathVariable Long id, @RequestBody PinRequest request) {
        return postService.setPinned(userId(auth), id, request.pinned());
    }

    @GetMapping("/{id}/comments")
    public List<CommentDto> comments(Authentication auth, @PathVariable Long id) {
        return postService.listComments(userId(auth), id);
    }

    @PostMapping("/{id}/comments")
    public CommentDto comment(Authentication auth, @PathVariable Long id,
            @Valid @RequestBody CreateCommentRequest request) {
        return postService.addComment(userId(auth), id, request.content());
    }
}
