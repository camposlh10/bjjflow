package com.bjjflow.backend.payments;

public enum PosWebhookStatus {
    RECEIVED,
    PROCESSED,
    DUPLICATE,
    UNRESOLVED_INVOICE,
    AMOUNT_MISMATCH,
    ALREADY_PAID,
    FAILED,
    IGNORED
}
