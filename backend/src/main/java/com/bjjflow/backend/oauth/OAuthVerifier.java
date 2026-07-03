package com.bjjflow.backend.oauth;

/**
 * Verifies a provider-issued ID token and returns the authenticated identity.
 * Implementations must throw {@code ApiException(401, "OAUTH_INVALID", ...)} for any
 * untrusted / unverifiable token. Mocked in tests so the linking logic is exercised
 * without real tokens.
 */
public interface OAuthVerifier {
    OAuthUserInfo verify(OAuthProvider provider, String idToken);
}
