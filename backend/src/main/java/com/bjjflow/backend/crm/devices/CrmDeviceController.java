package com.bjjflow.backend.crm.devices;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.crm.devices.CrmDeviceDtos.CreateDeviceRequest;
import com.bjjflow.backend.crm.devices.CrmDeviceDtos.DeviceResponse;
import com.bjjflow.backend.crm.devices.CrmDeviceDtos.DeviceWithKeyResponse;
import com.bjjflow.backend.crm.devices.CrmDeviceDtos.UpdateDeviceRequest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/crm/devices")
@RequiredArgsConstructor
public class CrmDeviceController {

    private final CrmDeviceService crmDeviceService;

    @PostMapping
    public DeviceWithKeyResponse register(Authentication auth, @Valid @RequestBody CreateDeviceRequest request) {
        return crmDeviceService.register(userId(auth), request);
    }

    @GetMapping
    public List<DeviceResponse> list(Authentication auth) {
        return crmDeviceService.list(userId(auth));
    }

    @PutMapping("/{deviceId}")
    public DeviceResponse update(Authentication auth, @PathVariable Long deviceId,
            @Valid @RequestBody UpdateDeviceRequest request) {
        return crmDeviceService.update(userId(auth), deviceId, request);
    }

    @PostMapping("/{deviceId}/rotate-key")
    public DeviceWithKeyResponse rotateKey(Authentication auth, @PathVariable Long deviceId) {
        return crmDeviceService.rotateKey(userId(auth), deviceId);
    }

    @PutMapping("/{deviceId}/deactivate")
    public DeviceResponse deactivate(Authentication auth, @PathVariable Long deviceId) {
        return crmDeviceService.deactivate(userId(auth), deviceId);
    }

    private static Long userId(Authentication auth) {
        return Long.parseLong(auth.getName());
    }
}
