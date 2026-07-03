package com.bjjflow.backend.gyms.verification;

import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.json.JsonParser;
import org.springframework.boot.json.JsonParserFactory;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;

/**
 * Sends the verification documents to Claude's vision API and asks for a
 * structured verdict. Any failure falls back to {@link CertificateVerdict#needsReview}
 * so a human always catches what the AI couldn't. Built only when
 * {@code anthropic.api-key} is configured (see VerifierConfig).
 */
public class ClaudeCertificateVerifier implements CertificateVerifier {

    private static final Logger log = LoggerFactory.getLogger(ClaudeCertificateVerifier.class);
    private static final JsonParser JSON = JsonParserFactory.getJsonParser();

    private static final String PROMPT = """
            You verify Brazilian jiu-jitsu gyms for a trust badge. You are given a coach's belt
            certificate, photos of the establishment, the owner's name and the gym's CNPJ.
            Judge ONLY from the images. Respond with a SINGLE minified JSON object, no prose:
            {"certificateValid": bool,  // a genuine martial-arts / BJJ belt (ideally black) certificate
             "beltLevel": string|null,  // belt read from the certificate, e.g. "black"
             "nameMatch": bool,         // certificate holder name matches the owner name given
             "establishmentValid": bool,// photos show a real training facility (mats / tatame visible)
             "confidence": number,      // 0..1 overall confidence in this assessment
             "redFlags": [string],      // e.g. "looks edited", "stock photo", "name mismatch"
             "summary": string}         // one short sentence for the human reviewer
            """;

    private final RestClient http = RestClient.builder().baseUrl("https://api.anthropic.com").build();
    private final String apiKey;
    private final String model;

    public ClaudeCertificateVerifier(String apiKey, String model) {
        this.apiKey = apiKey;
        this.model = model;
    }

    @Override
    public CertificateVerdict verify(String ownerName, String cnpj, List<Image> images) {
        try {
            List<Map<String, Object>> content = new ArrayList<>();
            content.add(Map.of("type", "text", "text",
                    PROMPT + "\nOwner name: " + ownerName + "\nCNPJ: " + cnpj));
            for (Image img : images) {
                content.add(Map.of(
                        "type", "image",
                        "source", Map.of(
                                "type", "base64",
                                "media_type", mime(img.contentType()),
                                "data", Base64.getEncoder().encodeToString(img.bytes()))));
            }
            Map<String, Object> body = Map.of(
                    "model", model,
                    "max_tokens", 1024,
                    "messages", List.of(Map.of("role", "user", "content", content)));

            String raw = http.post().uri("/v1/messages")
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", "2023-06-01")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(String.class);

            return parse(raw);
        } catch (Exception e) {
            log.warn("Claude verification failed, routing to manual review", e);
            return CertificateVerdict.needsReview("AI indisponível: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private CertificateVerdict parse(String raw) {
        Map<String, Object> envelope = JSON.parseMap(raw);
        List<Object> content = (List<Object>) envelope.get("content");
        String text = content == null || content.isEmpty()
                ? "{}"
                : String.valueOf(((Map<String, Object>) content.get(0)).get("text"));

        String json = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
        Map<String, Object> v = JSON.parseMap(json);

        List<String> redFlags = new ArrayList<>();
        Object rf = v.get("redFlags");
        if (rf instanceof List<?> list) {
            list.forEach(x -> redFlags.add(String.valueOf(x)));
        }
        return new CertificateVerdict(
                bool(v.get("certificateValid")),
                v.get("beltLevel") == null ? null : String.valueOf(v.get("beltLevel")),
                bool(v.get("nameMatch")),
                bool(v.get("establishmentValid")),
                v.get("confidence") instanceof Number n ? n.doubleValue() : 0,
                redFlags,
                v.get("summary") == null ? "" : String.valueOf(v.get("summary")));
    }

    private static boolean bool(Object o) {
        return Boolean.TRUE.equals(o) || "true".equalsIgnoreCase(String.valueOf(o));
    }

    private static String mime(String contentType) {
        if (contentType != null && contentType.startsWith("image/")) {
            String ct = contentType.toLowerCase();
            // Anthropic accepts jpeg/png/gif/webp
            if (ct.equals("image/jpg")) {
                return "image/jpeg";
            }
            return ct;
        }
        return "image/jpeg";
    }
}
