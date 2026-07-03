package com.bjjflow.backend.crm.devices;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.access.AccessDevice;
import com.bjjflow.backend.access.AccessDeviceRepository;
import com.bjjflow.backend.access.DeviceKeys;
import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.crm.devices.CrmDeviceDtos.CreateDeviceRequest;
import com.bjjflow.backend.crm.devices.CrmDeviceDtos.DeviceResponse;
import com.bjjflow.backend.crm.devices.CrmDeviceDtos.DeviceWithKeyResponse;
import com.bjjflow.backend.crm.devices.CrmDeviceDtos.UpdateDeviceRequest;
import com.bjjflow.backend.crm.security.CrmAccessService;
import com.bjjflow.backend.crm.security.CrmPrincipal;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CrmDeviceService {

    private final CrmAccessService crmAccessService;
    private final AccessDeviceRepository accessDeviceRepository;

    @Transactional
    public DeviceWithKeyResponse register(Long userId, CreateDeviceRequest request) {
        CrmPrincipal crm = crmAccessService.requireOwner(userId);
        String apiKey = DeviceKeys.generate();

        AccessDevice device = new AccessDevice();
        device.setGymId(crm.gymId());
        device.setName(request.name().trim());
        device.setType(request.type().trim());
        device.setProvider(blankToNull(request.provider()));
        device.setLocation(blankToNull(request.location()));
        device.setActive(true);
        device.setApiKeyHash(DeviceKeys.hash(apiKey));
        return new DeviceWithKeyResponse(response(accessDeviceRepository.save(device)), apiKey);
    }

    @Transactional(readOnly = true)
    public List<DeviceResponse> list(Long userId) {
        CrmPrincipal crm = crmAccessService.requireStaff(userId);
        return accessDeviceRepository.findAllByGymIdOrderByIdAsc(crm.gymId()).stream()
                .map(this::response)
                .toList();
    }

    @Transactional
    public DeviceResponse update(Long userId, Long deviceId, UpdateDeviceRequest request) {
        CrmPrincipal crm = crmAccessService.requireOwner(userId);
        AccessDevice device = deviceInGym(deviceId, crm.gymId());

        if (request.name() != null) {
            if (request.name().isBlank()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DEVICE_NAME", "Device name is invalid");
            }
            device.setName(request.name().trim());
        }
        if (request.type() != null) {
            if (request.type().isBlank()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DEVICE_TYPE", "Device type is invalid");
            }
            device.setType(request.type().trim());
        }
        if (request.provider() != null) {
            device.setProvider(blankToNull(request.provider()));
        }
        if (request.location() != null) {
            device.setLocation(blankToNull(request.location()));
        }
        if (request.active() != null) {
            device.setActive(request.active());
        }
        return response(accessDeviceRepository.save(device));
    }

    @Transactional
    public DeviceWithKeyResponse rotateKey(Long userId, Long deviceId) {
        CrmPrincipal crm = crmAccessService.requireOwner(userId);
        AccessDevice device = deviceInGym(deviceId, crm.gymId());
        String apiKey = DeviceKeys.generate();
        device.setApiKeyHash(DeviceKeys.hash(apiKey));
        return new DeviceWithKeyResponse(response(accessDeviceRepository.save(device)), apiKey);
    }

    @Transactional
    public DeviceResponse deactivate(Long userId, Long deviceId) {
        CrmPrincipal crm = crmAccessService.requireOwner(userId);
        AccessDevice device = deviceInGym(deviceId, crm.gymId());
        device.setActive(false);
        return response(accessDeviceRepository.save(device));
    }

    private AccessDevice deviceInGym(Long deviceId, Long gymId) {
        return accessDeviceRepository.findByIdAndGymId(deviceId, gymId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ACCESS_DEVICE_NOT_FOUND",
                        "Access device not found"));
    }

    private DeviceResponse response(AccessDevice device) {
        return new DeviceResponse(
                device.getId(), device.getGymId(), device.getName(), device.getType(),
                device.getProvider(), device.getLocation(), Boolean.TRUE.equals(device.getActive()),
                device.getCreatedAt(), device.getLastSeenAt());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
