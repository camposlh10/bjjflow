package com.bjjflow.backend.gyms.verification;

import java.util.List;

/** First-pass AI review of a gym's verification documents. */
public interface CertificateVerifier {

    /** One uploaded image plus its mime type. */
    record Image(byte[] bytes, String contentType, String kind) {
    }

    /**
     * @param ownerName  the submitting owner's display name (cross-checked against the certificate)
     * @param cnpj       normalized 14-digit CNPJ (already checksum-validated)
     * @param images     certificate + establishment photos
     */
    CertificateVerdict verify(String ownerName, String cnpj, List<Image> images);
}
