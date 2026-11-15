package com.bjjflow.backend.access.bridge;

import java.time.Instant;
import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import tools.jackson.databind.JsonNode;

public final class BridgeDtos {

    private BridgeDtos() {
    }

    // --- bridge app <-> cloud ---

    public record HeartbeatRequest(
            @Size(max = 40) String version,
            Integer queueDepth) {
    }

    public record HeartbeatResponse(
            List<CommandForBridge> commands,
            int pollSeconds) {
    }

    public record CommandForBridge(
            Long id,
            String type,
            JsonNode payload) {
    }

    public record CommandResultRequest(
            @NotNull Boolean success,
            @Size(max = 4000) String result) {
    }

    // --- CRM ---

    public record CreateBridgeRequest(
            @NotBlank @Size(max = 100) String name) {
    }

    public record BridgeResponse(
            Long id,
            String name,
            boolean active,
            boolean online,
            Instant createdAt,
            Instant lastSeenAt,
            String version,
            Integer queueDepth) {
    }

    /** Returned only on registration and key rotation; the key is not stored. */
    public record BridgeWithKeyResponse(
            BridgeResponse bridge,
            String apiKey) {
    }

    public record BridgeCommandResponse(
            Long id,
            String type,
            String status,
            int attempts,
            String result,
            Instant createdAt,
            Instant completedAt) {
    }
}
