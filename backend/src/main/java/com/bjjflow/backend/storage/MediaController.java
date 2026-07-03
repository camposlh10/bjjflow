package com.bjjflow.backend.storage;

import java.io.IOException;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.bjjflow.backend.common.ApiException;

import lombok.RequiredArgsConstructor;

/**
 * General media upload for any authenticated user (no gym membership required) —
 * used by user profiles (avatar, photos, certificate) and reused by gym flows.
 */
@RestController
@RequestMapping("/api/v1/media")
@RequiredArgsConstructor
public class MediaController {

    private final MediaStorage mediaStorage;

    public record UploadResult(String key, String url, String type) {
    }

    @PostMapping(consumes = "multipart/form-data")
    public UploadResult upload(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "EMPTY_FILE", "No file uploaded");
        }
        String contentType = file.getContentType();
        String type;
        if (contentType != null && contentType.startsWith("image/")) {
            type = "IMAGE";
        } else if (contentType != null && contentType.startsWith("video/")) {
            type = "VIDEO";
        } else {
            throw new ApiException(HttpStatus.BAD_REQUEST, "UNSUPPORTED_MEDIA", "Only images and videos are allowed");
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "UPLOAD_FAILED", "Could not read upload");
        }
        String key = mediaStorage.store(bytes, contentType, file.getOriginalFilename());
        return new UploadResult(key, mediaStorage.urlFor(key), type);
    }
}
