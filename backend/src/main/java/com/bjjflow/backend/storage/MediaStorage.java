package com.bjjflow.backend.storage;

/**
 * Storage abstraction for user-uploaded media. Swap the implementation (local
 * filesystem now; AWS S3 / Azure Blob later) without touching callers — only
 * {@link #store} and {@link #urlFor} are part of the contract.
 */
public interface MediaStorage {

    /**
     * Persists the given bytes and returns an opaque storage key
     * (e.g. {@code "posts/3f2a….jpg"}). The key is what we store in the
     * database; never the absolute URL, so the backend can be repointed.
     */
    String store(byte[] content, String contentType, String originalFilename);

    /**
     * Resolves a storage key to a URL the client can fetch. Returns a relative
     * path for local storage (the app prefixes the API origin) and an absolute
     * URL for cloud providers.
     */
    String urlFor(String key);

    /** Reads the raw bytes back (used to hand images to the AI verifier). */
    byte[] read(String key);
}
