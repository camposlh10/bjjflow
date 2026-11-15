package com.bjjflow.backend.access.bridge;

/**
 * Published when a bridge command settles (the bridge answered, or it was
 * given up after too many attempts), inside the same transaction.
 */
public record BridgeCommandFinished(Long commandId, BridgeCommandType type, boolean success, String result) {
}
