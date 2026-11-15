package com.bjjflow.backend.access.enrollment;

import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.access.AccessDevice;
import com.bjjflow.backend.access.AccessDeviceRepository;
import com.bjjflow.backend.access.bridge.AccessBridge;
import com.bjjflow.backend.access.bridge.AccessBridgeRepository;
import com.bjjflow.backend.access.bridge.BridgeCommand;
import com.bjjflow.backend.access.bridge.BridgeCommandFinished;
import com.bjjflow.backend.access.bridge.BridgeCommandType;
import com.bjjflow.backend.access.bridge.BridgeService;
import com.bjjflow.backend.access.enrollment.DeviceEnrollment.Method;
import com.bjjflow.backend.access.enrollment.DeviceEnrollment.Status;
import com.bjjflow.backend.access.enrollment.EnrollmentDtos.ConsentResponse;
import com.bjjflow.backend.access.enrollment.EnrollmentDtos.CreateEnrollmentRequest;
import com.bjjflow.backend.access.enrollment.EnrollmentDtos.EnrollmentResponse;
import com.bjjflow.backend.access.enrollment.EnrollmentDtos.MemberAccessResponse;
import com.bjjflow.backend.access.enrollment.EnrollmentDtos.RecordConsentRequest;
import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.crm.security.CrmAccessService;
import com.bjjflow.backend.crm.security.CrmPrincipal;
import com.bjjflow.backend.gyms.GymMemberRepository;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * Registers members on access devices through the gym's bridge, and removes
 * them again. Faces need the member's recorded consent (LGPD); revoking it
 * removes the face from every device. The device's user id is the member's
 * BJJ Flow user id, so its passages resolve without any mapping.
 */
@Service
@RequiredArgsConstructor
public class EnrollmentService {

    /** Bump when the consent text shown in the CRM changes. */
    public static final String CURRENT_TERMS_VERSION = "2026-11";

    private static final JsonMapper JSON = JsonMapper.builder().build();

    private final CrmAccessService crmAccessService;
    private final GymMemberRepository gymMemberRepository;
    private final UserRepository userRepository;
    private final AccessDeviceRepository accessDeviceRepository;
    private final AccessBridgeRepository accessBridgeRepository;
    private final BridgeService bridgeService;
    private final BiometricConsentRepository consentRepository;
    private final DeviceEnrollmentRepository enrollmentRepository;

    @Transactional(readOnly = true)
    public MemberAccessResponse memberAccess(Long callerId, Long memberUserId) {
        CrmPrincipal crm = staffFor(callerId, memberUserId);
        return access(crm.gymId(), memberUserId);
    }

    @Transactional
    public MemberAccessResponse recordConsent(Long callerId, Long memberUserId, RecordConsentRequest request) {
        CrmPrincipal crm = staffFor(callerId, memberUserId);
        if (activeConsent(crm.gymId(), memberUserId) == null) {
            BiometricConsent consent = new BiometricConsent();
            consent.setGymId(crm.gymId());
            consent.setUserId(memberUserId);
            consent.setTermsVersion(request.termsVersion().trim());
            consent.setGrantedAt(Instant.now());
            consent.setRecordedByUserId(callerId);
            consentRepository.save(consent);
        }
        return access(crm.gymId(), memberUserId);
    }

    /** LGPD: revoking consent removes the member's face from every device. */
    @Transactional
    public MemberAccessResponse revokeConsent(Long callerId, Long memberUserId) {
        CrmPrincipal crm = staffFor(callerId, memberUserId);
        BiometricConsent consent = activeConsent(crm.gymId(), memberUserId);
        if (consent != null) {
            consent.setRevokedAt(Instant.now());
            consent.setRevokedByUserId(callerId);
            consentRepository.save(consent);
        }
        for (DeviceEnrollment enrollment : enrollmentRepository.findAllByGymIdAndUserIdAndMethodAndStatusIn(
                crm.gymId(), memberUserId, Method.FACE, EnumSet.of(Status.PENDING, Status.ENROLLED, Status.FAILED))) {
            startRemoval(enrollment);
        }
        return access(crm.gymId(), memberUserId);
    }

    @Transactional
    public EnrollmentResponse enroll(Long callerId, Long memberUserId, CreateEnrollmentRequest request) {
        CrmPrincipal crm = staffFor(callerId, memberUserId);
        AccessDevice device = accessDeviceRepository.findByIdAndGymId(request.deviceId(), crm.gymId())
                .filter(d -> Boolean.TRUE.equals(d.getActive()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ACCESS_DEVICE_NOT_FOUND",
                        "Active access device not found"));
        AccessBridge bridge = bridgeFor(device);
        String vendor = vendorOf(device);
        if (request.method() == Method.FACE && activeConsent(crm.gymId(), memberUserId) == null) {
            throw new ApiException(HttpStatus.CONFLICT, "CONSENT_REQUIRED",
                    "Record the member's consent to facial recognition first");
        }
        String cardValue = request.method() == Method.CARD ? normalizeCard(request.cardValue()) : null;
        if (!enrollmentRepository.findAllByGymIdAndUserIdAndDeviceIdAndStatusIn(crm.gymId(), memberUserId,
                device.getId(), EnumSet.of(Status.PENDING, Status.REMOVING)).isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, "ENROLLMENT_IN_PROGRESS",
                    "Wait for the current registration on this device to finish");
        }
        User member = userRepository.findById(memberUserId).orElseThrow();

        ObjectNode payload = JSON.createObjectNode();
        payload.put("vendor", vendor);
        payload.put("host", device.getLanHost());
        payload.put("userId", memberUserId);
        payload.put("name", member.getDisplayName());
        payload.put("method", request.method().name());
        if (cardValue != null) {
            payload.put("cardValue", cardValue);
        }
        BridgeCommand command = bridgeService.enqueue(bridge, BridgeCommandType.DEVICE_ENROLL, payload);

        DeviceEnrollment enrollment = new DeviceEnrollment();
        enrollment.setGymId(crm.gymId());
        enrollment.setUserId(memberUserId);
        enrollment.setDeviceId(device.getId());
        enrollment.setMethod(request.method());
        enrollment.setCardValue(cardValue);
        enrollment.setStatus(Status.PENDING);
        enrollment.setCommandId(command.getId());
        enrollment.setCreatedByUserId(callerId);
        return response(enrollmentRepository.save(enrollment), Map.of(device.getId(), device));
    }

    @Transactional
    public EnrollmentResponse remove(Long callerId, Long memberUserId, Long enrollmentId) {
        CrmPrincipal crm = staffFor(callerId, memberUserId);
        DeviceEnrollment enrollment = enrollmentRepository.findByIdAndGymId(enrollmentId, crm.gymId())
                .filter(e -> e.getUserId().equals(memberUserId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ENROLLMENT_NOT_FOUND",
                        "Enrollment not found"));
        startRemoval(enrollment);
        return response(enrollment, devicesById(List.of(enrollment)));
    }

    /** Settles enrollments when the bridge reports back on their command. */
    @EventListener
    public void onCommandFinished(BridgeCommandFinished finished) {
        if (finished.type() != BridgeCommandType.DEVICE_ENROLL && finished.type() != BridgeCommandType.DEVICE_REMOVE) {
            return;
        }
        enrollmentRepository.findByCommandId(finished.commandId()).ifPresent(enrollment -> {
            boolean removal = finished.type() == BridgeCommandType.DEVICE_REMOVE;
            if (finished.success()) {
                enrollment.setStatus(removal ? Status.REMOVED : Status.ENROLLED);
                enrollment.setLastError(null);
            } else {
                // A failed removal stays REMOVING so staff see it still needs attention.
                enrollment.setStatus(removal ? Status.REMOVING : Status.FAILED);
                enrollment.setLastError(clip(errorText(finished.result()), 500));
            }
            enrollmentRepository.save(enrollment);
        });
    }

    private void startRemoval(DeviceEnrollment enrollment) {
        if (enrollment.getStatus() == Status.REMOVED) {
            return;
        }
        AccessDevice device = accessDeviceRepository.findById(enrollment.getDeviceId()).orElseThrow();
        AccessBridge bridge = bridgeFor(device);
        ObjectNode payload = JSON.createObjectNode();
        payload.put("vendor", vendorOf(device));
        payload.put("host", device.getLanHost());
        payload.put("userId", enrollment.getUserId());
        BridgeCommand command = bridgeService.enqueue(bridge, BridgeCommandType.DEVICE_REMOVE, payload);
        enrollment.setStatus(Status.REMOVING);
        enrollment.setCommandId(command.getId());
        enrollment.setLastError(null);
        enrollmentRepository.save(enrollment);
    }

    private AccessBridge bridgeFor(AccessDevice device) {
        if (device.getBridgeId() == null || device.getLanHost() == null) {
            throw new ApiException(HttpStatus.CONFLICT, "DEVICE_NOT_LINKED",
                    "Link the device to a bridge and set its network address first");
        }
        return accessBridgeRepository.findById(device.getBridgeId())
                .filter(b -> Boolean.TRUE.equals(b.getActive()))
                .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "BRIDGE_INACTIVE",
                        "The device's bridge is inactive"));
    }

    /** Only brands the bridge has a driver for can enroll. */
    private static String vendorOf(AccessDevice device) {
        String provider = device.getProvider() == null ? "" : device.getProvider().toLowerCase(Locale.ROOT);
        if (provider.replaceAll("[^a-z]", "").contains("controlid")) {
            return "controlid";
        }
        throw new ApiException(HttpStatus.CONFLICT, "VENDOR_NOT_SUPPORTED",
                "Registering members from the CRM is available for Control iD devices");
    }

    /** "123.45678" (facility.card, as printed) -> facility * 2^32 + card; digits stay as they are. */
    static String normalizeCard(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "CARD_VALUE_REQUIRED", "Card number is required");
        }
        String value = raw.trim().replace(',', '.');
        if (!value.contains(".")) {
            return new java.math.BigInteger(value).toString();
        }
        String[] parts = value.split("\\.");
        java.math.BigInteger facility = new java.math.BigInteger(parts[0]);
        java.math.BigInteger card = new java.math.BigInteger(parts[1]);
        return facility.shiftLeft(32).add(card).toString();
    }

    private MemberAccessResponse access(Long gymId, Long memberUserId) {
        BiometricConsent consent = activeConsent(gymId, memberUserId);
        List<DeviceEnrollment> enrollments = enrollmentRepository.findAllByGymIdAndUserIdOrderByIdDesc(gymId,
                memberUserId);
        Map<Long, AccessDevice> devices = devicesById(enrollments);
        return new MemberAccessResponse(
                consent == null ? null
                        : new ConsentResponse(consent.getId(), consent.getTermsVersion(), consent.getGrantedAt(),
                                consent.getRecordedByUserId()),
                CURRENT_TERMS_VERSION,
                enrollments.stream().map(e -> response(e, devices)).toList());
    }

    private Map<Long, AccessDevice> devicesById(List<DeviceEnrollment> enrollments) {
        return accessDeviceRepository.findAllById(enrollments.stream().map(DeviceEnrollment::getDeviceId).toList())
                .stream().collect(Collectors.toMap(AccessDevice::getId, Function.identity()));
    }

    private BiometricConsent activeConsent(Long gymId, Long memberUserId) {
        return consentRepository.findFirstByGymIdAndUserIdAndRevokedAtIsNullOrderByIdDesc(gymId, memberUserId)
                .orElse(null);
    }

    private CrmPrincipal staffFor(Long callerId, Long memberUserId) {
        CrmPrincipal crm = crmAccessService.requireStaff(callerId);
        if (gymMemberRepository.findByGymIdAndUserId(crm.gymId(), memberUserId).isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "Member not found in this gym");
        }
        return crm;
    }

    private static EnrollmentResponse response(DeviceEnrollment e, Map<Long, AccessDevice> devices) {
        AccessDevice device = devices.get(e.getDeviceId());
        return new EnrollmentResponse(e.getId(), e.getDeviceId(), device == null ? null : device.getName(),
                e.getMethod().name(), e.getCardValue(), e.getStatus().name(), e.getLastError(), e.getCreatedAt(),
                e.getUpdatedAt());
    }

    /** The bridge reports errors as plain text or as {"error": "..."}. */
    private static String errorText(String result) {
        if (result == null) {
            return "Failed on the device";
        }
        try {
            var node = JSON.readTree(result);
            if (node.hasNonNull("error")) {
                return node.get("error").asString();
            }
        } catch (RuntimeException notJson) {
            // plain text
        }
        return result;
    }

    private static String clip(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }
}
