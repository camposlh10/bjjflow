package com.bjjflow.backend.access.bridge;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.access.bridge.BridgeDtos.BridgeCommandResponse;
import com.bjjflow.backend.access.bridge.BridgeDtos.CommandResultRequest;
import com.bjjflow.backend.access.bridge.BridgeDtos.HeartbeatRequest;
import com.bjjflow.backend.access.bridge.BridgeDtos.HeartbeatResponse;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * Called by the BJJ Flow Bridge app, authenticated with its own key in the
 * {@code X-Bridge-Key} header. The bridge always calls out (it sits behind the
 * gym's router), so commands ride back on the heartbeat answer.
 */
@RestController
@RequestMapping("/api/v1/access/bridge")
@RequiredArgsConstructor
public class BridgeController {

    public static final String BRIDGE_KEY_HEADER = "X-Bridge-Key";

    private final BridgeService bridgeService;

    @PostMapping("/heartbeat")
    public HeartbeatResponse heartbeat(@RequestHeader(name = BRIDGE_KEY_HEADER, required = false) String key,
            @Valid @RequestBody(required = false) HeartbeatRequest request) {
        return bridgeService.heartbeat(bridgeService.authenticate(key), request);
    }

    @PostMapping("/commands/{commandId}/result")
    public BridgeCommandResponse result(@RequestHeader(name = BRIDGE_KEY_HEADER, required = false) String key,
            @PathVariable Long commandId, @Valid @RequestBody CommandResultRequest request) {
        return bridgeService.complete(bridgeService.authenticate(key), commandId, request);
    }
}
