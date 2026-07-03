package com.bjjflow.backend.storage;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Stores media on the local filesystem and serves it via the {@code /media/**}
 * static route (see WebConfig). Active by default; replace by setting
 * {@code app.media.provider} to a cloud implementation later.
 */
@Component
@ConditionalOnProperty(name = "app.media.provider", havingValue = "local", matchIfMissing = true)
public class LocalMediaStorage implements MediaStorage {

    private final Path baseDir;

    public LocalMediaStorage(@Value("${app.media.local-dir:./data/media}") String dir) {
        this.baseDir = Paths.get(dir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(baseDir.resolve("posts"));
        } catch (IOException e) {
            throw new UncheckedIOException("Could not create media directory " + baseDir, e);
        }
    }

    @Override
    public String store(byte[] content, String contentType, String originalFilename) {
        String key = "posts/" + UUID.randomUUID() + extensionFor(contentType, originalFilename);
        Path target = baseDir.resolve(key).normalize();
        if (!target.startsWith(baseDir)) {
            throw new IllegalArgumentException("Resolved path escapes the media directory");
        }
        try {
            Files.write(target, content);
        } catch (IOException e) {
            throw new UncheckedIOException("Could not store media", e);
        }
        return key;
    }

    @Override
    public String urlFor(String key) {
        return "/media/" + key;
    }

    @Override
    public byte[] read(String key) {
        Path target = baseDir.resolve(key).normalize();
        if (!target.startsWith(baseDir)) {
            throw new IllegalArgumentException("Resolved path escapes the media directory");
        }
        try {
            return Files.readAllBytes(target);
        } catch (IOException e) {
            throw new UncheckedIOException("Could not read media " + key, e);
        }
    }

    private String extensionFor(String contentType, String originalFilename) {
        if (contentType != null) {
            switch (contentType.toLowerCase()) {
                case "image/jpeg":
                    return ".jpg";
                case "image/png":
                    return ".png";
                case "image/webp":
                    return ".webp";
                case "image/heic":
                    return ".heic";
                case "video/mp4":
                    return ".mp4";
                case "video/quicktime":
                    return ".mov";
                default:
                    break;
            }
        }
        if (originalFilename != null && originalFilename.contains(".")) {
            return originalFilename.substring(originalFilename.lastIndexOf('.'));
        }
        return "";
    }
}
