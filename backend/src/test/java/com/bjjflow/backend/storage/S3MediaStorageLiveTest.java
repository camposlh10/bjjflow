package com.bjjflow.backend.storage;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

/**
 * Round trip against a real bucket: server-side store, read back, signed read URL
 * and a direct (presigned) upload. Runs only when APP_MEDIA_S3_BUCKET is set, e.g.
 * with a Railway bucket's credentials exported in the shell.
 */
@EnabledIfEnvironmentVariable(named = "APP_MEDIA_S3_BUCKET", matches = ".+")
class S3MediaStorageLiveTest {

    private final HttpClient http = HttpClient.newHttpClient();

    private S3MediaStorage storage() {
        return new S3MediaStorage(
                System.getenv("APP_MEDIA_S3_ENDPOINT"),
                System.getenv().getOrDefault("APP_MEDIA_S3_REGION", "auto"),
                System.getenv("APP_MEDIA_S3_BUCKET"),
                System.getenv("APP_MEDIA_S3_ACCESS_KEY"),
                System.getenv("APP_MEDIA_S3_SECRET_KEY"),
                System.getenv().getOrDefault("APP_MEDIA_S3_PUBLIC_BASE_URL", ""),
                Boolean.parseBoolean(System.getenv().getOrDefault("APP_MEDIA_S3_PATH_STYLE", "true")));
    }

    @Test
    void storesReadsAndSignsReads() throws Exception {
        S3MediaStorage storage = storage();
        byte[] content = "fake png bytes".getBytes(StandardCharsets.UTF_8);

        String key = storage.store(content, "image/png", "test.png");

        assertThat(storage.read(key)).isEqualTo(content);
        assertThat(storage.urlFor(key)).isEqualTo("/media/" + key);
        HttpResponse<byte[]> get = http.send(HttpRequest.newBuilder(URI.create(storage.presignRead(key))).build(),
                HttpResponse.BodyHandlers.ofByteArray());
        assertThat(get.statusCode()).isEqualTo(200);
        assertThat(get.body()).isEqualTo(content);
    }

    @Test
    void acceptsDirectUploads() throws Exception {
        S3MediaStorage storage = storage();
        byte[] content = "direct upload".getBytes(StandardCharsets.UTF_8);
        String key = MediaKeys.newKey("image/jpeg", "photo.jpg");

        var upload = storage.presignUpload(key, "image/jpeg", content.length).orElseThrow();
        var put = HttpRequest.newBuilder(URI.create(upload.uploadUrl()))
                .PUT(HttpRequest.BodyPublishers.ofByteArray(content));
        upload.headers().forEach(put::header);
        assertThat(http.send(put.build(), HttpResponse.BodyHandlers.discarding()).statusCode()).isEqualTo(200);

        assertThat(storage.read(key)).isEqualTo(content);
    }

    @Test
    void importsLocalFilesOnceUnderTheSameKey(@org.junit.jupiter.api.io.TempDir java.nio.file.Path dir) throws Exception {
        S3MediaStorage storage = storage();
        String key = MediaKeys.newKey("image/png", "old.png");
        java.nio.file.Path file = dir.resolve(key);
        java.nio.file.Files.createDirectories(file.getParent());
        java.nio.file.Files.write(file, "from the volume".getBytes(StandardCharsets.UTF_8));

        LocalMediaImporter importer = new LocalMediaImporter(storage, dir.toString());

        assertThat(importer.importAll()).isEqualTo(1);
        assertThat(storage.read(key)).isEqualTo("from the volume".getBytes(StandardCharsets.UTF_8));
        assertThat(importer.importAll()).isZero();
    }
}
