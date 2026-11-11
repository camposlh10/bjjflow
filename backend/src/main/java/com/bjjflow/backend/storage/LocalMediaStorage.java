package com.bjjflow.backend.storage;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Stores media on the local filesystem and serves it via the {@code /media/**}
 * static route (see WebConfig). Development only: files do not survive a
 * redeploy and are not shared between instances. Production sets
 * {@code app.media.provider=s3} (see S3MediaStorage).
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
        String key = MediaKeys.newKey(contentType, originalFilename);
        try {
            Files.write(resolve(key), content);
        } catch (IOException e) {
            throw new UncheckedIOException("Could not store media", e);
        }
        return key;
    }

    @Override
    public String store(InputStream content, long length, String contentType, String originalFilename)
            throws IOException {
        String key = MediaKeys.newKey(contentType, originalFilename);
        Files.copy(content, resolve(key), StandardCopyOption.REPLACE_EXISTING);
        return key;
    }

    @Override
    public String urlFor(String key) {
        return "/media/" + key;
    }

    @Override
    public byte[] read(String key) {
        try {
            return Files.readAllBytes(resolve(key));
        } catch (IOException e) {
            throw new UncheckedIOException("Could not read media " + key, e);
        }
    }

    private Path resolve(String key) {
        Path target = baseDir.resolve(key).normalize();
        if (!target.startsWith(baseDir)) {
            throw new IllegalArgumentException("Resolved path escapes the media directory");
        }
        return target;
    }
}
