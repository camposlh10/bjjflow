package com.bjjflow.backend.access;

public enum AccessEventStatus {
    RECEIVED,
    PROCESSED_ATTENDANCE,
    PROCESSED_GYM_VISIT,
    UNRESOLVED_MEMBER,
    UNRESOLVED_CLASS,
    DUPLICATE,
    FAILED,
    IGNORED
}
