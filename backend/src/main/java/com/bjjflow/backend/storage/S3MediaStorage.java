package com.bjjflow.backend.storage;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import jakarta.annotation.PreDestroy;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

/**
 * S3-compatible object storage (Cloudflare R2, AWS S3, MinIO…). Active when
 * {@code app.media.provider=s3}.
 *
 * Clients upload straight to the bucket through a short-lived presigned URL
 * ({@link #presignUpload}), so large videos never pass through this server.
 * Files are read back from {@code app.media.s3.public-base-url}: the bucket's
 * public/CDN domain.
 */
@Component
@ConditionalOnProperty(name = "app.media.provider", havingValue = "s3")
public class S3MediaStorage implements MediaStorage {

    private static final Duration UPLOAD_URL_TTL = Duration.ofMinutes(10);

    private final S3Client client;
    private final S3Presigner presigner;
    private final String bucket;
    private final String publicBaseUrl;

    public S3MediaStorage(
            @Value("${app.media.s3.endpoint:}") String endpoint,
            @Value("${app.media.s3.region:auto}") String region,
            @Value("${app.media.s3.bucket}") String bucket,
            @Value("${app.media.s3.access-key}") String accessKey,
            @Value("${app.media.s3.secret-key}") String secretKey,
            @Value("${app.media.s3.public-base-url}") String publicBaseUrl) {
        this.bucket = bucket;
        this.publicBaseUrl = publicBaseUrl.replaceAll("/+$", "");

        var credentials = StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey));
        // Path-style addressing works on every S3-compatible provider.
        S3Configuration s3Config = S3Configuration.builder().pathStyleAccessEnabled(true).build();

        var clientBuilder = S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(credentials)
                .serviceConfiguration(s3Config)
                // Only send checksums the API requires: the SDK's optional CRC
                // trailers are not accepted by every S3-compatible provider.
                .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
                .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED);
        var presignerBuilder = S3Presigner.builder()
                .region(Region.of(region))
                .credentialsProvider(credentials)
                .serviceConfiguration(s3Config);
        if (endpoint != null && !endpoint.isBlank()) {
            clientBuilder.endpointOverride(URI.create(endpoint));
            presignerBuilder.endpointOverride(URI.create(endpoint));
        }
        this.client = clientBuilder.build();
        this.presigner = presignerBuilder.build();
    }

    @Override
    public String store(byte[] content, String contentType, String originalFilename) {
        String key = MediaKeys.newKey(contentType, originalFilename);
        client.putObject(putRequest(key, contentType, content.length), RequestBody.fromBytes(content));
        return key;
    }

    @Override
    public String store(InputStream content, long length, String contentType, String originalFilename)
            throws IOException {
        String key = MediaKeys.newKey(contentType, originalFilename);
        client.putObject(putRequest(key, contentType, length), RequestBody.fromInputStream(content, length));
        return key;
    }

    @Override
    public Optional<DirectUpload> presignUpload(String key, String contentType, long sizeBytes) {
        PresignedPutObjectRequest presigned = presigner.presignPutObject(PutObjectPresignRequest.builder()
                .signatureDuration(UPLOAD_URL_TTL)
                // Content type and exact size are part of the signature: the URL
                // cannot be reused to upload a different or larger file.
                .putObjectRequest(putRequest(key, contentType, sizeBytes))
                .build());
        Map<String, String> headers = new LinkedHashMap<>();
        presigned.signedHeaders().forEach((name, values) -> {
            // The HTTP client sets these two itself.
            if (!name.equalsIgnoreCase("host") && !name.equalsIgnoreCase("content-length") && !values.isEmpty()) {
                headers.put(name, values.get(0));
            }
        });
        return Optional.of(new DirectUpload(presigned.url().toString(), headers));
    }

    @Override
    public String urlFor(String key) {
        return publicBaseUrl + "/" + key;
    }

    @Override
    public byte[] read(String key) {
        return client.getObjectAsBytes(GetObjectRequest.builder().bucket(bucket).key(key).build()).asByteArray();
    }

    private PutObjectRequest putRequest(String key, String contentType, long length) {
        return PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(contentType)
                .contentLength(length)
                .build();
    }

    @PreDestroy
    void close() {
        presigner.close();
        client.close();
    }
}
