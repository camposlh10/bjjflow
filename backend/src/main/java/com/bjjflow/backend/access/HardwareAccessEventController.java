package com.bjjflow.backend.access;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.access.AccessDtos.AccessEventResponse;
import com.bjjflow.backend.access.AccessDtos.HardwareAccessEventRequest;
import com.bjjflow.backend.common.ApiException;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * Ingestion endpoint for access-control hardware (fingerprint readers, card
 * scanners, turnstiles). Devices authenticate with their API key via the
 * {@code X-Device-Key} header instead of a user JWT.
 */
@RestController
@RequestMapping("/api/v1/access/hardware")
@RequiredArgsConstructor
public class HardwareAccessEventController {

    public static final String DEVICE_KEY_HEADER = "X-Device-Key";

    private final AccessDeviceRepository accessDeviceRepository;
    private final AccessEventProcessor accessEventProcessor;

    @PostMapping("/events")
    public AccessEventResponse create(
            @RequestHeader(name = DEVICE_KEY_HEADER, required = false) String deviceKey,
            @Valid @RequestBody HardwareAccessEventRequest request) {
        if (deviceKey == null || deviceKey.isBlank()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "DEVICE_KEY_REQUIRED",
                    DEVICE_KEY_HEADER + " header is required");
        }
        AccessDevice device = accessDeviceRepository
                .findByApiKeyHashAndActiveTrue(DeviceKeys.hash(deviceKey.trim()))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_DEVICE_KEY",
                        "Unknown or inactive device key"));
        return accessEventProcessor.ingestFromDevice(device, request);
    }
}
