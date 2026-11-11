package com.bjjflow.backend.storage;

import java.io.IOException;
import java.io.InputStream;
import java.util.Map;
import java.util.Optional;

/**
 * Storage abstraction for user-uploaded media. Callers only ever persist the
 * opaque storage key, never a URL, so the backing store can be repointed
 * (local disk in dev, S3-compatible object storage in production).
 */
public interface MediaStorage {

    /**
     * A one-time URL the client uploads the file to directly, bypassing this
     * server. {@code headers} must be sent verbatim with the PUT.
     */
    record DirectUpload(String uploadUrl, Map<String, String> headers) {
    }

    /**
     * Persists the given bytes and returns an opaque storage key
     * (e.g. {@code "posts/3f2a….jpg"}).
     */
    String store(byte[] content, String contentType, String originalFilename);

    /**
     * Streaming variant of {@link #store(byte[], String, String)}: implementations
     * that can, write the stream through without buffering the whole file in memory.
     */
    default String store(InputStream content, long length, String contentType, String originalFilename)
            throws IOException {
        return store(content.readAllBytes(), contentType, originalFilename);
    }

    /**
     * Reserves a key and returns where the client should upload it. Empty when
     * the provider has no direct-upload support (local disk): the client then
     * falls back to the multipart endpoint.
     */
    default Optional<DirectUpload> presignUpload(String key, String contentType, long sizeBytes) {
        return Optional.empty();
    }

    /**
     * Resolves a storage key to a URL the client can fetch. Returns a relative
     * path for local storage (the app prefixes the API origin) and an absolute
     * URL for cloud providers.
     */
    String urlFor(String key);

    /** Reads the raw bytes back (used to hand images to the AI verifier). */
    byte[] read(String key);
}
