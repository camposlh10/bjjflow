package com.bjjflow.backend.access;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import com.bjjflow.backend.access.AccessDtos.AccessEventResponse;
import com.bjjflow.backend.access.AccessDtos.CreateAccessEventRequest;
import com.bjjflow.backend.access.AccessDtos.HardwareAccessEventRequest;
import com.bjjflow.backend.checkins.CheckInService;
import com.bjjflow.backend.classes.ClassAttendance;
import com.bjjflow.backend.classes.ClassAttendanceRepository;
import com.bjjflow.backend.classes.GymClass;
import com.bjjflow.backend.classes.GymClassRepository;
import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.crm.security.CrmAccessService;
import com.bjjflow.backend.crm.security.CrmPrincipal;
import com.bjjflow.backend.gyms.GymMemberRepository;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AccessEventProcessor {

    private static final Duration BEFORE_CLASS = Duration.ofMinutes(30);
    private static final Duration AFTER_CLASS = Duration.ofMinutes(15);

    private final CrmAccessService crmAccessService;
    private final AccessDeviceRepository accessDeviceRepository;
    private final MemberCredentialRepository memberCredentialRepository;
    private final RawAccessEventRepository rawAccessEventRepository;
    private final GymMemberRepository gymMemberRepository;
    private final UserRepository userRepository;
    private final GymClassRepository gymClassRepository;
    private final ClassAttendanceRepository classAttendanceRepository;
    private final CheckInService checkInService;
    private final TransactionTemplate transactionTemplate;

    public AccessEventResponse ingest(Long callerId, CreateAccessEventRequest request) {
        CrmPrincipal crm = crmAccessService.requireStaff(callerId);
        AccessDevice device = accessDeviceRepository.findByIdAndActiveTrue(request.deviceId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ACCESS_DEVICE_NOT_FOUND",
                        "Active access device not found"));
        if (!crm.gymId().equals(device.getGymId())) {
            throw new ApiException(HttpStatus.NOT_FOUND, "ACCESS_DEVICE_NOT_FOUND", "Active access device not found");
        }
        return ingestForDevice(device, request.studentUserId(), request.externalMemberId(),
                request.eventTime(), request.source(), request.notes());
    }

    /**
     * Ingestion path for hardware authenticated by device API key. The device
     * is already resolved and trusted; eventTime defaults to now and source
     * defaults to the device type for hardware that sends minimal payloads.
     */
    public AccessEventResponse ingestFromDevice(AccessDevice device, HardwareAccessEventRequest request) {
        device.setLastSeenAt(Instant.now());
        accessDeviceRepository.save(device);
        Instant eventTime = request.eventTime() == null ? Instant.now() : request.eventTime();
        AccessEventSource source = request.source() == null ? defaultSource(device) : request.source();
        return ingestForDevice(device, request.studentUserId(), request.externalMemberId(),
                eventTime, source, request.notes());
    }

    private AccessEventResponse ingestForDevice(AccessDevice device, Long studentUserId, String externalMemberId,
            Instant eventTime, AccessEventSource source, String notes) {
        if (studentUserId == null && (externalMemberId == null || externalMemberId.isBlank())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "MEMBER_IDENTIFIER_REQUIRED",
                    "studentUserId or externalMemberId is required");
        }

        RawAccessEvent duplicateOf = rawAccessEventRepository.findDuplicate(
                device.getId(), studentUserId, blankToNull(externalMemberId),
                eventTime, source).orElse(null);

        RawAccessEvent event = new RawAccessEvent();
        event.setGymId(device.getGymId());
        event.setDeviceId(device.getId());
        event.setStudentUserId(studentUserId);
        event.setExternalMemberId(blankToNull(externalMemberId));
        event.setEventTime(eventTime);
        event.setSource(source);
        event.setNotes(blankToNull(notes));

        if (duplicateOf != null) {
            event.setStatus(AccessEventStatus.DUPLICATE);
            event.setProcessed(true);
            event.setProcessedAt(Instant.now());
            event.setNotes(appendNote(event.getNotes(), "Duplicate of raw event " + duplicateOf.getId()));
            return response(rawAccessEventRepository.save(event));
        }

        event.setStatus(AccessEventStatus.RECEIVED);
        event.setProcessed(false);
        event = rawAccessEventRepository.saveAndFlush(event);
        Long eventId = event.getId();

        try {
            transactionTemplate.executeWithoutResult(status -> processStoredEvent(eventId));
        } catch (RuntimeException exception) {
            markFailed(eventId, exception);
        }

        return response(rawAccessEventRepository.findById(eventId).orElseThrow());
    }

    public AccessEventResponse reprocess(Long eventId) {
        try {
            transactionTemplate.executeWithoutResult(status -> {
                RawAccessEvent event = rawAccessEventRepository.findById(eventId).orElseThrow();
                event.setStatus(AccessEventStatus.RECEIVED);
                event.setProcessed(false);
                event.setProcessedAt(null);
                event.setMatchedClassId(null);
                rawAccessEventRepository.save(event);
                processStoredEvent(eventId);
            });
        } catch (RuntimeException exception) {
            markFailed(eventId, exception);
        }
        return response(rawAccessEventRepository.findById(eventId).orElseThrow());
    }

    public AccessEventResponse assignClass(Long eventId, Long classId, Long markedByUserId) {
        transactionTemplate.executeWithoutResult(status -> {
            RawAccessEvent event = rawAccessEventRepository.findById(eventId).orElseThrow();
            GymClass gymClass = gymClassRepository.findById(classId).orElseThrow();
            if (!event.getGymId().equals(gymClass.getGymId())) {
                throw new ApiException(HttpStatus.NOT_FOUND, "CLASS_NOT_FOUND", "Class not found");
            }
            Long studentUserId = resolveStudent(event);
            if (studentUserId == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "UNRESOLVED_MEMBER",
                        "Link the access event to a member first");
            }
            event.setStudentUserId(studentUserId);
            recordAttendance(event, gymClass, studentUserId, markedByUserId);
            event.setMatchedClassId(classId);
            complete(event, AccessEventStatus.PROCESSED_ATTENDANCE);
            rawAccessEventRepository.save(event);
        });
        return response(rawAccessEventRepository.findById(eventId).orElseThrow());
    }

    private void processStoredEvent(Long eventId) {
        RawAccessEvent event = rawAccessEventRepository.findById(eventId).orElseThrow();
        Long studentUserId = resolveStudent(event);
        if (studentUserId == null) {
            complete(event, AccessEventStatus.UNRESOLVED_MEMBER);
            event.setNotes(appendNote(event.getNotes(), "Member could not be resolved in this gym"));
            rawAccessEventRepository.save(event);
            return;
        }
        event.setStudentUserId(studentUserId);

        ZoneId zone = ZoneId.systemDefault();
        ZonedDateTime eventAt = event.getEventTime().atZone(zone);
        List<GymClass> dayClasses = gymClassRepository
                .findAllByGymIdAndDayOfWeekAndActiveTrueOrderByStartTimeAsc(
                        event.getGymId(), eventAt.getDayOfWeek().getValue());
        GymClass matchedClass = findMatchingClass(dayClasses, eventAt);
        if (matchedClass == null) {
            complete(event, dayClasses.isEmpty()
                    ? AccessEventStatus.PROCESSED_GYM_VISIT
                    : AccessEventStatus.UNRESOLVED_CLASS);
            rawAccessEventRepository.save(event);
            return;
        }

        recordAttendance(event, matchedClass, studentUserId, null);
        event.setMatchedClassId(matchedClass.getId());
        complete(event, AccessEventStatus.PROCESSED_ATTENDANCE);
        rawAccessEventRepository.save(event);
    }

    private void recordAttendance(RawAccessEvent event, GymClass matchedClass, Long studentUserId,
            Long markedByUserId) {
        LocalDate classDate = event.getEventTime().atZone(ZoneId.systemDefault()).toLocalDate();
        ClassAttendance attendance = classAttendanceRepository
                .findByGymClassIdAndClassDateAndUserId(matchedClass.getId(), classDate, studentUserId)
                .orElseGet(ClassAttendance::new);
        attendance.setGymClassId(matchedClass.getId());
        attendance.setClassDate(classDate);
        attendance.setUserId(studentUserId);
        attendance.setStatus("PRESENT");
        attendance.setMarkedByUserId(markedByUserId);
        classAttendanceRepository.save(attendance);
        checkInService.ensureDailyCheckIn(studentUserId, classDate);
    }

    private Long resolveStudent(RawAccessEvent event) {
        if (event.getStudentUserId() != null) {
            return gymMemberRepository.findByGymIdAndUserId(event.getGymId(), event.getStudentUserId())
                    .map(member -> member.getUserId())
                    .orElse(null);
        }
        String externalId = event.getExternalMemberId();
        if (externalId == null) {
            return null;
        }
        // Hardware identifiers (card UID, fingerprint id, QR payload) enrolled
        // through the CRM take priority over the id/username fallbacks.
        MemberCredential credential = memberCredentialRepository
                .findFirstByGymIdAndValueIgnoreCaseAndActiveTrue(event.getGymId(), externalId).orElse(null);
        if (credential != null
                && gymMemberRepository.findByGymIdAndUserId(event.getGymId(), credential.getUserId()).isPresent()) {
            return credential.getUserId();
        }
        try {
            Long userId = Long.valueOf(externalId);
            if (gymMemberRepository.findByGymIdAndUserId(event.getGymId(), userId).isPresent()) {
                return userId;
            }
        } catch (NumberFormatException ignored) {
            // Non-numeric identifiers may be BJJ Flow usernames.
        }
        return userRepository.findByUsernameIgnoreCase(externalId)
                .filter(user -> gymMemberRepository.findByGymIdAndUserId(event.getGymId(), user.getId()).isPresent())
                .map(user -> user.getId())
                .orElse(null);
    }

    private GymClass findMatchingClass(List<GymClass> dayClasses, ZonedDateTime eventAt) {
        LocalDate date = eventAt.toLocalDate();
        return dayClasses.stream()
                .filter(gymClass -> {
                    ZonedDateTime opens = ZonedDateTime.of(date, gymClass.getStartTime(), eventAt.getZone())
                            .minus(BEFORE_CLASS);
                    ZonedDateTime closes = ZonedDateTime.of(date, gymClass.getEndTime(), eventAt.getZone())
                            .plus(AFTER_CLASS);
                    return !eventAt.isBefore(opens) && !eventAt.isAfter(closes);
                })
                .min(Comparator.comparingLong(gymClass -> Math.abs(Duration.between(
                        eventAt,
                        ZonedDateTime.of(date, gymClass.getStartTime(), eventAt.getZone())).toMinutes())))
                .orElse(null);
    }

    private void markFailed(Long eventId, RuntimeException exception) {
        rawAccessEventRepository.findById(eventId).ifPresent(event -> {
            complete(event, AccessEventStatus.FAILED);
            String message = exception.getMessage() == null ? exception.getClass().getSimpleName() : exception.getMessage();
            event.setNotes(appendNote(event.getNotes(), "Processing failed: " + clip(message, 500)));
            rawAccessEventRepository.save(event);
        });
    }

    private static void complete(RawAccessEvent event, AccessEventStatus status) {
        event.setStatus(status);
        event.setProcessed(true);
        event.setProcessedAt(Instant.now());
    }

    public static AccessEventResponse response(RawAccessEvent event) {
        return new AccessEventResponse(
                event.getId(), event.getGymId(), event.getDeviceId(), event.getStudentUserId(),
                event.getExternalMemberId(), event.getEventTime(), event.getSource().name(), event.getStatus().name(),
                Boolean.TRUE.equals(event.getProcessed()), event.getProcessedAt(), event.getMatchedClassId(),
                event.getNotes());
    }

    private static AccessEventSource defaultSource(AccessDevice device) {
        try {
            return AccessEventSource.valueOf(device.getType().trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            return AccessEventSource.GENERIC;
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String appendNote(String current, String addition) {
        return current == null ? addition : clip(current + "; " + addition, 1000);
    }

    private static String clip(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }
}
