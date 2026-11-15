package com.bjjflow.backend.access.bridge;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.access.DeviceKeys;
import com.bjjflow.backend.access.bridge.BridgeDtos.BridgeCommandResponse;
import com.bjjflow.backend.access.bridge.BridgeDtos.BridgeResponse;
import com.bjjflow.backend.access.bridge.BridgeDtos.BridgeWithKeyResponse;
import com.bjjflow.backend.access.bridge.BridgeDtos.CommandForBridge;
import com.bjjflow.backend.access.bridge.BridgeDtos.CommandResultRequest;
import com.bjjflow.backend.access.bridge.BridgeDtos.HeartbeatRequest;
import com.bjjflow.backend.access.bridge.BridgeDtos.HeartbeatResponse;
import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.crm.security.CrmAccessService;
import com.bjjflow.backend.crm.security.CrmPrincipal;

import lombok.RequiredArgsConstructor;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Service
@RequiredArgsConstructor
public class BridgeService {

    /** How often the bridge checks in; also how fast commands reach it. */
    static final int POLL_SECONDS = 5;
    /** Shown as online when it checked in this recently. */
    static final Duration ONLINE_WINDOW = Duration.ofSeconds(60);
    /** A handed-out command with no result by then is handed out again. */
    static final Duration REDELIVER_AFTER = Duration.ofMinutes(2);
    static final int MAX_ATTEMPTS = 5;
    private static final int BATCH = 10;

    private static final JsonMapper JSON = JsonMapper.builder().build();

    private final AccessBridgeRepository bridgeRepository;
    private final BridgeCommandRepository commandRepository;
    private final CrmAccessService crmAccessService;
    private final ApplicationEventPublisher events;

    // --- bridge app ---

    @Transactional(readOnly = true)
    public AccessBridge authenticate(String apiKey) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "BRIDGE_KEY_REQUIRED", "X-Bridge-Key header is required");
        }
        return bridgeRepository.findByApiKeyHashAndActiveTrue(DeviceKeys.hash(apiKey.trim()))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_BRIDGE_KEY",
                        "Unknown or inactive bridge key"));
    }

    /** Records that the bridge is alive and hands it the commands waiting for it. */
    @Transactional
    public HeartbeatResponse heartbeat(AccessBridge bridge, HeartbeatRequest request) {
        Instant now = Instant.now();
        bridge.setLastSeenAt(now);
        if (request != null) {
            bridge.setVersion(request.version());
            bridge.setQueueDepth(request.queueDepth());
        }
        bridgeRepository.save(bridge);

        List<BridgeCommand> deliverable = commandRepository.lockDeliverable(
                bridge.getId(), now.minus(REDELIVER_AFTER), PageRequest.of(0, BATCH));
        List<CommandForBridge> out = new java.util.ArrayList<>();
        for (BridgeCommand command : deliverable) {
            if (command.getAttempts() >= MAX_ATTEMPTS) {
                command.setStatus(BridgeCommand.Status.FAILED);
                command.setResult("No result from the bridge after " + MAX_ATTEMPTS + " attempts");
                command.setCompletedAt(now);
                events.publishEvent(new BridgeCommandFinished(command.getId(), command.getType(), false,
                        command.getResult()));
                continue;
            }
            command.setStatus(BridgeCommand.Status.SENT);
            command.setSentAt(now);
            command.setAttempts(command.getAttempts() + 1);
            out.add(new CommandForBridge(command.getId(), command.getType().name(), parse(command.getPayload())));
        }
        commandRepository.saveAll(deliverable);
        return new HeartbeatResponse(out, POLL_SECONDS);
    }

    @Transactional
    public BridgeCommandResponse complete(AccessBridge bridge, Long commandId, CommandResultRequest request) {
        BridgeCommand command = commandRepository.findByIdAndBridgeId(commandId, bridge.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "COMMAND_NOT_FOUND", "Command not found"));
        // A late answer for a command already settled changes nothing.
        if (command.getStatus() != BridgeCommand.Status.DONE && command.getStatus() != BridgeCommand.Status.FAILED) {
            command.setStatus(Boolean.TRUE.equals(request.success())
                    ? BridgeCommand.Status.DONE
                    : BridgeCommand.Status.FAILED);
            command.setResult(clip(request.result(), 4000));
            command.setCompletedAt(Instant.now());
            commandRepository.save(command);
            events.publishEvent(new BridgeCommandFinished(command.getId(), command.getType(),
                    command.getStatus() == BridgeCommand.Status.DONE, command.getResult()));
        }
        return response(command);
    }

    /** Queues work for a bridge; used by the CRM and by later integrations (enrollment). */
    @Transactional
    public BridgeCommand enqueue(AccessBridge bridge, BridgeCommandType type, JsonNode payload) {
        BridgeCommand command = new BridgeCommand();
        command.setBridgeId(bridge.getId());
        command.setType(type);
        command.setPayload(payload == null ? null : JSON.writeValueAsString(payload));
        command.setStatus(BridgeCommand.Status.PENDING);
        return commandRepository.save(command);
    }

    // --- CRM ---

    @Transactional
    public BridgeWithKeyResponse register(Long userId, String name) {
        CrmPrincipal crm = crmAccessService.requireOwner(userId);
        String apiKey = DeviceKeys.generate("bjjb");
        AccessBridge bridge = new AccessBridge();
        bridge.setGymId(crm.gymId());
        bridge.setName(name.trim());
        bridge.setApiKeyHash(DeviceKeys.hash(apiKey));
        bridge.setActive(true);
        return new BridgeWithKeyResponse(response(bridgeRepository.save(bridge)), apiKey);
    }

    @Transactional(readOnly = true)
    public List<BridgeResponse> list(Long userId) {
        CrmPrincipal crm = crmAccessService.requireStaff(userId);
        return bridgeRepository.findAllByGymIdOrderByIdAsc(crm.gymId()).stream().map(BridgeService::response).toList();
    }

    @Transactional
    public BridgeWithKeyResponse rotateKey(Long userId, Long bridgeId) {
        AccessBridge bridge = ownedBridge(userId, bridgeId);
        String apiKey = DeviceKeys.generate("bjjb");
        bridge.setApiKeyHash(DeviceKeys.hash(apiKey));
        return new BridgeWithKeyResponse(response(bridgeRepository.save(bridge)), apiKey);
    }

    @Transactional
    public BridgeResponse deactivate(Long userId, Long bridgeId) {
        AccessBridge bridge = ownedBridge(userId, bridgeId);
        bridge.setActive(false);
        return response(bridgeRepository.save(bridge));
    }

    @Transactional
    public BridgeCommandResponse ping(Long userId, Long bridgeId) {
        CrmPrincipal crm = crmAccessService.requireStaff(userId);
        AccessBridge bridge = bridgeInGym(bridgeId, crm.gymId());
        return response(enqueue(bridge, BridgeCommandType.PING, null));
    }

    @Transactional(readOnly = true)
    public List<BridgeCommandResponse> recentCommands(Long userId, Long bridgeId) {
        CrmPrincipal crm = crmAccessService.requireStaff(userId);
        bridgeInGym(bridgeId, crm.gymId());
        return commandRepository.findAllByBridgeIdOrderByIdDesc(bridgeId, PageRequest.of(0, 20)).stream()
                .map(BridgeService::response)
                .toList();
    }

    private AccessBridge ownedBridge(Long userId, Long bridgeId) {
        CrmPrincipal crm = crmAccessService.requireOwner(userId);
        return bridgeInGym(bridgeId, crm.gymId());
    }

    private AccessBridge bridgeInGym(Long bridgeId, Long gymId) {
        return bridgeRepository.findByIdAndGymId(bridgeId, gymId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "BRIDGE_NOT_FOUND", "Bridge not found"));
    }

    static BridgeResponse response(AccessBridge bridge) {
        boolean online = Boolean.TRUE.equals(bridge.getActive()) && bridge.getLastSeenAt() != null
                && bridge.getLastSeenAt().isAfter(Instant.now().minus(ONLINE_WINDOW));
        return new BridgeResponse(bridge.getId(), bridge.getName(), Boolean.TRUE.equals(bridge.getActive()), online,
                bridge.getCreatedAt(), bridge.getLastSeenAt(), bridge.getVersion(), bridge.getQueueDepth());
    }

    static BridgeCommandResponse response(BridgeCommand command) {
        return new BridgeCommandResponse(command.getId(), command.getType().name(), command.getStatus().name(),
                command.getAttempts(), command.getResult(), command.getCreatedAt(), command.getCompletedAt());
    }

    private static JsonNode parse(String payload) {
        if (payload == null) {
            return null;
        }
        try {
            return JSON.readTree(payload);
        } catch (JacksonException invalid) {
            return null;
        }
    }

    private static String clip(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }
}
