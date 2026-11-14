package com.bjjflow.backend.storage;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.stream.Stream;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * One-way copy of media saved on local disk (before the bucket existed) into the
 * bucket, under the same keys, so stored keys keep working after switching
 * {@code app.media.provider} to s3. Runs in the background on start, skips keys
 * the bucket already has, and never deletes the local files.
 */
@Component
@ConditionalOnProperty(name = "app.media.provider", havingValue = "s3")
public class LocalMediaImporter {

    private static final Logger log = LoggerFactory.getLogger(LocalMediaImporter.class);

    private final S3MediaStorage storage;
    private final Path baseDir;

    public LocalMediaImporter(S3MediaStorage storage, @Value("${app.media.local-dir:./data/media}") String dir) {
        this.storage = storage;
        this.baseDir = Paths.get(dir).toAbsolutePath().normalize();
    }

    @EventListener(ApplicationReadyEvent.class)
    public void importInBackground() {
        if (!Files.isDirectory(baseDir)) {
            return;
        }
        Thread.ofVirtual().name("media-import").start(this::importAll);
    }

    /** Returns how many files were copied. */
    int importAll() {
        List<Path> files;
        try (Stream<Path> walk = Files.walk(baseDir)) {
            files = walk.filter(Files::isRegularFile).toList();
        } catch (IOException e) {
            log.warn("Media import: could not list {}: {}", baseDir, e.getMessage());
            return 0;
        }
        int copied = 0;
        int failed = 0;
        for (Path file : files) {
            String key = baseDir.relativize(file).toString().replace('\\', '/');
            try {
                if (storage.exists(key)) {
                    continue;
                }
                storage.put(key, file, contentType(file));
                copied++;
            } catch (Exception e) {
                failed++;
                log.warn("Media import: could not copy {}: {}", key, e.getMessage());
            }
        }
        if (copied > 0 || failed > 0) {
            log.info("Media import: copied {} of {} local file(s) to the bucket, {} failed", copied, files.size(), failed);
        }
        return copied;
    }

    private static String contentType(Path file) {
        try {
            String probed = Files.probeContentType(file);
            if (probed != null) {
                return probed;
            }
        } catch (IOException ignored) {
            // fall through to the extension
        }
        String name = file.getFileName().toString().toLowerCase();
        if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
        if (name.endsWith(".png")) return "image/png";
        if (name.endsWith(".webp")) return "image/webp";
        if (name.endsWith(".heic")) return "image/heic";
        if (name.endsWith(".mp4")) return "video/mp4";
        if (name.endsWith(".mov")) return "video/quicktime";
        return "application/octet-stream";
    }
}
