package com.bjjflow.backend.gyms.verification;

import java.util.List;

/**
 * Structured outcome of the AI first-pass over a gym's verification submission.
 * {@code confidence} is 0..1. Produced by {@link CertificateVerifier}.
 */
public record CertificateVerdict(
        boolean certificateValid,
        String beltLevel,
        boolean nameMatch,
        boolean establishmentValid,
        double confidence,
        List<String> redFlags,
        String summary) {

    public static CertificateVerdict needsReview(String summary) {
        return new CertificateVerdict(false, null, false, false, 0, List.of(), summary);
    }
}
