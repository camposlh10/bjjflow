package com.bjjflow.backend.access.bridge;

public enum BridgeCommandType {
    /** Round trip check from the CRM; the bridge answers with its version. */
    PING,
    /**
     * An HTTP request the bridge makes to a device on the gym's network:
     * {@code {"method","url","headers","body"}}. The bridge only calls hosts
     * listed in its own config, whatever the cloud asks.
     */
    DEVICE_HTTP,
    /**
     * Register a member on a device: {@code {"vendor","host","userId","name",
     * "method":"FACE"|"CARD","cardValue"}}. The bridge logs in with the device
     * credentials from its own config; for FACE the device captures the face
     * itself and keeps it (the photo is not sent back to the cloud).
     */
    DEVICE_ENROLL,
    /** Remove a member (and their face/cards) from a device: {@code {"vendor","host","userId"}}. */
    DEVICE_REMOVE
}
