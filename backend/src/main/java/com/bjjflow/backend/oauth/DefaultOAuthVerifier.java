package com.bjjflow.backend.oauth;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.spec.RSAPublicKeySpec;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.json.JsonParser;
import org.springframework.boot.json.JsonParserFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.bjjflow.backend.common.ApiException;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;

/**
 * Verifies Google and Apple ID tokens.
 *  - Google: calls the public tokeninfo endpoint and checks the audience.
 *  - Apple: verifies the JWT signature against Apple's published JWKS, then checks
 *    issuer + audience.
 * Either provider rejects (OAUTH_INVALID) when no allowed audiences are configured,
 * so social login fails closed until {@code oauth.<provider>.client-ids} is set.
 */
@Component
public class DefaultOAuthVerifier implements OAuthVerifier {

    private static final Logger log = LoggerFactory.getLogger(DefaultOAuthVerifier.class);
    private static final JsonParser JSON = JsonParserFactory.getJsonParser();
    private static final String APPLE_ISSUER = "https://appleid.apple.com";

    private final RestClient http = RestClient.builder().build();
    private final Set<String> googleAudiences;
    private final Set<String> appleAudiences;

    public DefaultOAuthVerifier(
            @Value("${oauth.google.client-ids:}") String googleClientIds,
            @Value("${oauth.apple.client-ids:}") String appleClientIds) {
        this.googleAudiences = csv(googleClientIds);
        this.appleAudiences = csv(appleClientIds);
    }

    @Override
    public OAuthUserInfo verify(OAuthProvider provider, String idToken) {
        return switch (provider) {
            case GOOGLE -> verifyGoogle(idToken);
            case APPLE -> verifyApple(idToken);
        };
    }

    // --- Google ---------------------------------------------------------------

    private OAuthUserInfo verifyGoogle(String idToken) {
        if (googleAudiences.isEmpty()) {
            throw invalid("Google sign-in is not configured");
        }
        Map<String, Object> claims;
        try {
            String raw = http.get()
                    .uri("https://oauth2.googleapis.com/tokeninfo?id_token={t}", idToken)
                    .retrieve()
                    .body(String.class);
            claims = JSON.parseMap(raw);
        } catch (Exception e) {
            throw invalid("Could not verify Google token: " + e.getMessage());
        }
        String aud = str(claims.get("aud"));
        if (aud == null || !googleAudiences.contains(aud)) {
            throw invalid("Google token audience mismatch");
        }
        String sub = str(claims.get("sub"));
        if (sub == null) {
            throw invalid("Google token missing subject");
        }
        return new OAuthUserInfo(
                OAuthProvider.GOOGLE,
                sub,
                str(claims.get("email")),
                bool(claims.get("email_verified")),
                str(claims.get("name")));
    }

    // --- Apple ----------------------------------------------------------------

    private OAuthUserInfo verifyApple(String idToken) {
        if (appleAudiences.isEmpty()) {
            throw invalid("Apple sign-in is not configured");
        }
        try {
            String kid = appleKid(idToken);
            PublicKey key = applePublicKey(kid);
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .requireIssuer(APPLE_ISSUER)
                    .build()
                    .parseSignedClaims(idToken)
                    .getPayload();
            Set<String> auds = claims.getAudience();
            if (auds == null || auds.stream().noneMatch(appleAudiences::contains)) {
                throw invalid("Apple token audience mismatch");
            }
            return new OAuthUserInfo(
                    OAuthProvider.APPLE,
                    claims.getSubject(),
                    claims.get("email", String.class),
                    bool(claims.get("email_verified")),
                    null); // Apple sends the name only to the client on first sign-in
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw invalid("Could not verify Apple token: " + e.getMessage());
        }
    }

    private String appleKid(String idToken) {
        String[] parts = idToken.split("\\.");
        if (parts.length < 2) {
            throw invalid("Malformed Apple token");
        }
        Map<String, Object> header = JSON.parseMap(new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8));
        String kid = str(header.get("kid"));
        if (kid == null) {
            throw invalid("Apple token missing key id");
        }
        return kid;
    }

    @SuppressWarnings("unchecked")
    private PublicKey applePublicKey(String kid) throws Exception {
        String raw = http.get().uri("https://appleid.apple.com/auth/keys").retrieve().body(String.class);
        List<Object> keys = (List<Object>) JSON.parseMap(raw).get("keys");
        Map<String, Object> jwk = keys.stream()
                .map(k -> (Map<String, Object>) k)
                .filter(k -> kid.equals(str(k.get("kid"))))
                .findFirst()
                .orElseThrow(() -> invalid("Apple signing key not found"));
        BigInteger modulus = new BigInteger(1, Base64.getUrlDecoder().decode(str(jwk.get("n"))));
        BigInteger exponent = new BigInteger(1, Base64.getUrlDecoder().decode(str(jwk.get("e"))));
        return KeyFactory.getInstance("RSA").generatePublic(new RSAPublicKeySpec(modulus, exponent));
    }

    // --- helpers --------------------------------------------------------------

    private static ApiException invalid(String message) {
        log.warn("OAuth verification rejected: {}", message);
        return new ApiException(HttpStatus.UNAUTHORIZED, "OAUTH_INVALID", message);
    }

    private static Set<String> csv(String value) {
        if (value == null || value.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(value.split(",")).map(String::trim).filter(s -> !s.isEmpty()).collect(Collectors.toSet());
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private static boolean bool(Object o) {
        return Boolean.TRUE.equals(o) || "true".equalsIgnoreCase(String.valueOf(o));
    }
}
