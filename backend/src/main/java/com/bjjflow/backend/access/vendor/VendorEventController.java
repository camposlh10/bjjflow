package com.bjjflow.backend.access.vendor;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.access.AccessDevice;
import com.bjjflow.backend.access.AccessDeviceRepository;
import com.bjjflow.backend.access.AccessDtos.HardwareAccessEventRequest;
import com.bjjflow.backend.access.AccessEventProcessor;
import com.bjjflow.backend.access.DeviceKeys;
import com.bjjflow.backend.common.ApiException;

/**
 * Receives notifications in a brand's own format, straight from the device
 * (or relayed by the gym's bridge). Many devices can't send headers, so the
 * device key is part of the path: {@code /api/v1/access/vendors/<brand>/<key>/<endpoint>}.
 *
 * Every accepted notification answers 200 with an empty body, also when it
 * carries nothing to count: devices treat other answers as failures and
 * retry or fall back to offline mode.
 */
@RestController
@RequestMapping("/api/v1/access/vendors")
public class VendorEventController {

    private static final Logger log = LoggerFactory.getLogger(VendorEventController.class);

    private final Map<String, VendorAdapter> adapters;
    private final AccessDeviceRepository accessDeviceRepository;
    private final AccessEventProcessor accessEventProcessor;

    public VendorEventController(List<VendorAdapter> adapters, AccessDeviceRepository accessDeviceRepository,
            AccessEventProcessor accessEventProcessor) {
        this.adapters = adapters.stream().collect(Collectors.toMap(VendorAdapter::vendor, Function.identity()));
        this.accessDeviceRepository = accessDeviceRepository;
        this.accessEventProcessor = accessEventProcessor;
    }

    @PostMapping("/{vendor}/{deviceKey}/{*endpoint}")
    public ResponseEntity<Void> receive(@PathVariable String vendor, @PathVariable String deviceKey,
            @PathVariable String endpoint, @RequestBody(required = false) String body) {
        VendorAdapter adapter = adapters.get(vendor);
        if (adapter == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "UNKNOWN_VENDOR", "No integration for " + vendor);
        }
        AccessDevice device = accessDeviceRepository
                .findByApiKeyHashAndActiveTrue(DeviceKeys.hash(deviceKey.trim()))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_DEVICE_KEY",
                        "Unknown or inactive device key"));

        String path = endpoint.replaceAll("^/+|/+$", "");
        List<HardwareAccessEventRequest> scans = adapter.translate(path, body);
        if (scans.isEmpty()) {
            // Heartbeats and ignored notifications still show the device is online.
            device.setLastSeenAt(Instant.now());
            accessDeviceRepository.save(device);
        }
        for (HardwareAccessEventRequest scan : scans) {
            try {
                accessEventProcessor.ingestFromDevice(device, scan);
            } catch (ApiException rejected) {
                // One bad log must not make the device resend the whole batch.
                log.warn("{} device {}: scan rejected: {}", vendor, device.getId(), rejected.getMessage());
            }
        }
        return ResponseEntity.ok().build();
    }
}
