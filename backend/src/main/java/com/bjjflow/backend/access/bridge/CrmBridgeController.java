package com.bjjflow.backend.access.bridge;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.access.bridge.BridgeDtos.BridgeCommandResponse;
import com.bjjflow.backend.access.bridge.BridgeDtos.BridgeResponse;
import com.bjjflow.backend.access.bridge.BridgeDtos.BridgeWithKeyResponse;
import com.bjjflow.backend.access.bridge.BridgeDtos.CreateBridgeRequest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** Bridges as the gym's staff see them in the CRM. */
@RestController
@RequestMapping("/api/v1/crm/bridges")
@RequiredArgsConstructor
public class CrmBridgeController {

    private final BridgeService bridgeService;

    @PostMapping
    public BridgeWithKeyResponse register(Authentication auth, @Valid @RequestBody CreateBridgeRequest request) {
        return bridgeService.register(userId(auth), request.name());
    }

    @GetMapping
    public List<BridgeResponse> list(Authentication auth) {
        return bridgeService.list(userId(auth));
    }

    @PostMapping("/{bridgeId}/rotate-key")
    public BridgeWithKeyResponse rotateKey(Authentication auth, @PathVariable Long bridgeId) {
        return bridgeService.rotateKey(userId(auth), bridgeId);
    }

    @PutMapping("/{bridgeId}/deactivate")
    public BridgeResponse deactivate(Authentication auth, @PathVariable Long bridgeId) {
        return bridgeService.deactivate(userId(auth), bridgeId);
    }

    /** Queues a PING; the CRM polls the commands list to show the answer. */
    @PostMapping("/{bridgeId}/ping")
    public BridgeCommandResponse ping(Authentication auth, @PathVariable Long bridgeId) {
        return bridgeService.ping(userId(auth), bridgeId);
    }

    @GetMapping("/{bridgeId}/commands")
    public List<BridgeCommandResponse> commands(Authentication auth, @PathVariable Long bridgeId) {
        return bridgeService.recentCommands(userId(auth), bridgeId);
    }

    private static Long userId(Authentication auth) {
        return Long.parseLong(auth.getName());
    }
}
