package com.bjjflow.backend.storage;

import java.io.IOException;
import java.io.InputStream;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.bjjflow.backend.common.ApiException;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;

/**
 * General media upload for any authenticated user (no gym membership required) —
 * used by user profiles (avatar, photos, certificate) and reused by gym flows.
 *
 * Two paths: {@code POST /media/uploads} hands out a direct-to-storage upload
 * URL (preferred: the file never touches this server); {@code POST /media}
 * accepts the file itself, for local dev and app builds that predate direct uploads.
 */
@RestController
@RequestMapping("/api/v1/media")
@RequiredArgsConstructor
public class MediaController {

    static final long MAX_IMAGE_BYTES = 20L * 1024 * 1024;
    static final long MAX_VIDEO_BYTES = 50L * 1024 * 1024;

    private final MediaStorage mediaStorage;

    public record UploadResult(String key, String url, String type) {
    }

    public record UploadRequest(
            @NotBlank @Size(max = 100) String contentType,
            @Positive long sizeBytes,
            @Size(max = 255) String filename) {
    }

    /**
     * {@code direct=false} means this deployment has no direct-upload storage:
     * the client must send the file to {@code POST /media} instead.
     */
    public record UploadTicket(boolean direct, String key, String url, String type, String uploadUrl,
            Map<String, String> headers) {
    }

    @PostMapping("/uploads")
    public UploadTicket requestUpload(@Valid @RequestBody UploadRequest request) {
        String type = mediaType(request.contentType());
        long max = "VIDEO".equals(type) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
        if (request.sizeBytes() > max) {
            throw new ApiException(HttpStatus.CONTENT_TOO_LARGE, "FILE_TOO_LARGE",
                    "File exceeds the " + (max / (1024 * 1024)) + " MB limit");
        }
        String key = MediaKeys.newKey(request.contentType(), request.filename());
        return mediaStorage.presignUpload(key, request.contentType(), request.sizeBytes())
                .map(upload -> new UploadTicket(true, key, mediaStorage.urlFor(key), type, upload.uploadUrl(),
                        upload.headers()))
                .orElseGet(() -> new UploadTicket(false, null, null, type, null, null));
    }

    @PostMapping(consumes = "multipart/form-data")
    public UploadResult upload(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "EMPTY_FILE", "No file uploaded");
        }
        String contentType = file.getContentType();
        String type = mediaType(contentType);
        String key;
        try (InputStream in = file.getInputStream()) {
            key = mediaStorage.store(in, file.getSize(), contentType, file.getOriginalFilename());
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "UPLOAD_FAILED", "Could not read upload");
        }
        return new UploadResult(key, mediaStorage.urlFor(key), type);
    }

    private static String mediaType(String contentType) {
        if (contentType != null && contentType.startsWith("image/")) {
            return "IMAGE";
        }
        if (contentType != null && contentType.startsWith("video/")) {
            return "VIDEO";
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "UNSUPPORTED_MEDIA", "Only images and videos are allowed");
    }
}
