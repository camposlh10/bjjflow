package com.bjjflow.backend.oauth;

/** Identity extracted from a verified provider token. */
public record OAuthUserInfo(
        OAuthProvider provider,
        String subject,
        String email,
        boolean emailVerified,
        String name) {
}
