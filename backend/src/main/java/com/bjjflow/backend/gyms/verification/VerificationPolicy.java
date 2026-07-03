package com.bjjflow.backend.gyms.verification;

/**
 * Turns an AI {@link CertificateVerdict} into a decision. Deliberately
 * conservative: only auto-approve confident, clean positives and only
 * auto-reject confident junk — everything in between goes to a human.
 */
public final class VerificationPolicy {

    public enum Decision {
        APPROVED,
        REJECTED,
        NEEDS_REVIEW,
    }

    /** Auto-approve threshold. Raise it as you trust the model more; lower it as volume grows. */
    public static final double APPROVE_CONFIDENCE = 0.85;
    public static final double REJECT_CONFIDENCE = 0.80;

    private VerificationPolicy() {
    }

    public static Decision decide(CertificateVerdict v) {
        if (v == null) {
            return Decision.NEEDS_REVIEW;
        }
        boolean clean = v.redFlags() == null || v.redFlags().isEmpty();
        boolean strongPositive = v.certificateValid() && v.establishmentValid() && v.nameMatch()
                && v.confidence() >= APPROVE_CONFIDENCE && clean;
        if (strongPositive) {
            return Decision.APPROVED;
        }
        boolean confidentJunk = !v.certificateValid() && !v.establishmentValid()
                && v.confidence() >= REJECT_CONFIDENCE;
        if (confidentJunk) {
            return Decision.REJECTED;
        }
        return Decision.NEEDS_REVIEW;
    }
}
