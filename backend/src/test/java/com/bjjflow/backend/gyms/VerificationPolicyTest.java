package com.bjjflow.backend.gyms;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.bjjflow.backend.gyms.verification.CertificateVerdict;
import com.bjjflow.backend.gyms.verification.VerificationPolicy;
import com.bjjflow.backend.gyms.verification.VerificationPolicy.Decision;

class VerificationPolicyTest {

    @Test
    void confidentCleanPositiveIsAutoApproved() {
        CertificateVerdict v = new CertificateVerdict(true, "black", true, true, 0.92, List.of(), "ok");
        assertThat(VerificationPolicy.decide(v)).isEqualTo(Decision.APPROVED);
    }

    @Test
    void redFlagBlocksAutoApprove() {
        CertificateVerdict v = new CertificateVerdict(true, "black", true, true, 0.95,
                List.of("looks edited"), "suspeito");
        assertThat(VerificationPolicy.decide(v)).isEqualTo(Decision.NEEDS_REVIEW);
    }

    @Test
    void lowConfidencePositiveGoesToReview() {
        CertificateVerdict v = new CertificateVerdict(true, "black", true, true, 0.6, List.of(), "incerto");
        assertThat(VerificationPolicy.decide(v)).isEqualTo(Decision.NEEDS_REVIEW);
    }

    @Test
    void nameMismatchGoesToReview() {
        CertificateVerdict v = new CertificateVerdict(true, "black", false, true, 0.95, List.of(), "nome difere");
        assertThat(VerificationPolicy.decide(v)).isEqualTo(Decision.NEEDS_REVIEW);
    }

    @Test
    void confidentJunkIsAutoRejected() {
        CertificateVerdict v = new CertificateVerdict(false, null, false, false, 0.9, List.of("stock photo"), "lixo");
        assertThat(VerificationPolicy.decide(v)).isEqualTo(Decision.REJECTED);
    }

    @Test
    void stubNeedsReviewVerdictRoutesToHuman() {
        assertThat(VerificationPolicy.decide(CertificateVerdict.needsReview("sem ia")))
                .isEqualTo(Decision.NEEDS_REVIEW);
    }
}
