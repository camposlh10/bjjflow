package com.bjjflow.backend.gyms.verification;

import java.util.List;

/**
 * Used when no AI key is configured: routes every submission to manual review
 * so the human pipeline is always the fallback.
 */
public class StubCertificateVerifier implements CertificateVerifier {

    @Override
    public CertificateVerdict verify(String ownerName, String cnpj, List<Image> images) {
        return CertificateVerdict.needsReview("Revisão manual (IA não configurada)");
    }
}
