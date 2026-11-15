package com.bjjflow.backend.access.bridge;

public enum BridgeCommandType {
    /** Round trip check from the CRM; the bridge answers with its version. */
    PING,
    /**
     * An HTTP request the bridge makes to a device on the gym's network:
     * {@code {"method","url","headers","body"}}. The bridge only calls hosts
     * listed in its own config, whatever the cloud asks.
     */
    DEVICE_HTTP
}
