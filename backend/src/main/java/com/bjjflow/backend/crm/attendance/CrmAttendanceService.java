package com.bjjflow.backend.crm.attendance;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.access.AccessDevice;
import com.bjjflow.backend.access.AccessDeviceRepository;
import com.bjjflow.backend.access.AccessEventProcessor;
import com.bjjflow.backend.access.AccessEventStatus;
import com.bjjflow.backend.access.RawAccessEvent;
import com.bjjflow.backend.access.RawAccessEventRepository;
import com.bjjflow.backend.checkins.CheckInService;
import com.bjjflow.backend.classes.ClassAttendance;
import com.bjjflow.backend.classes.ClassAttendanceRepository;
import com.bjjflow.backend.classes.ClassService;
import com.bjjflow.backend.classes.GymClass;
import com.bjjflow.backend.classes.GymClassRepository;
import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.crm.attendance.CrmAttendanceDtos.AttendanceChangeResponse;
import com.bjjflow.backend.crm.attendance.CrmAttendanceDtos.AttendanceResponse;
import com.bjjflow.backend.crm.attendance.CrmAttendanceDtos.AccessEventReviewResponse;
import com.bjjflow.backend.crm.attendance.CrmAttendanceDtos.MarkAttendanceRequest;
import com.bjjflow.backend.crm.security.CrmAccessService;
import com.bjjflow.backend.crm.security.CrmPrincipal;
import com.bjjflow.backend.gyms.GymMemberRepository;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CrmAttendanceService {

    private static final List<AccessEventStatus> REVIEWABLE_ACCESS_STATUSES = List.of(
            AccessEventStatus.RECEIVED,
            AccessEventStatus.UNRESOLVED_MEMBER,
            AccessEventStatus.UNRESOLVED_CLASS,
            AccessEventStatus.DUPLICATE,
            AccessEventStatus.FAILED);

    private final CrmAccessService crmAccessService;
    private final AccessEventProcessor accessEventProcessor;
    private final AccessDeviceRepository accessDeviceRepository;
    private final RawAccessEventRepository rawAccessEventRepository;
    private final ClassService classService;
    private final CheckInService checkInService;
    private final ClassAttendanceRepository classAttendanceRepository;
    private final GymClassRepository gymClassRepository;
    private final GymMemberRepository gymMemberRepository;
    private final UserRepository userRepository;

    @Transactional
    public AttendanceChangeResponse mark(Long callerId, MarkAttendanceRequest request) {
        CrmPrincipal crm = crmAccessService.requireStaff(callerId);
        requireClassInGym(request.classId(), crm.gymId());
        requireMemberInGym(request.userId(), crm.gymId());

        String status = requestedStatus(request);
        if ("REMOVED".equals(status)) {
            classService.markAttendance(callerId, request.classId(), request.date(), request.userId(), false);
        } else if ("PRESENT".equals(status)) {
            classService.markAttendance(callerId, request.classId(), request.date(), request.userId(), true);
        } else {
            ClassAttendance attendance = classAttendanceRepository
                    .findByGymClassIdAndClassDateAndUserId(request.classId(), request.date(), request.userId())
                    .orElseGet(ClassAttendance::new);
            attendance.setGymClassId(request.classId());
            attendance.setClassDate(request.date());
            attendance.setUserId(request.userId());
            attendance.setStatus(status);
            attendance.setMarkedByUserId(callerId);
            classAttendanceRepository.save(attendance);
            if ("LATE".equals(status)) {
                checkInService.ensureDailyCheckIn(request.userId(), request.date());
            }
        }
        boolean attended = "PRESENT".equals(status) || "LATE".equals(status);
        return new AttendanceChangeResponse(request.classId(), request.userId(), request.date(), attended, status);
    }

    @Transactional(readOnly = true)
    public List<AttendanceResponse> today(Long callerId) {
        CrmPrincipal crm = crmAccessService.requireStaff(callerId);
        return responses(classAttendanceRepository.findAttendedInGymOnDate(crm.gymId(), LocalDate.now()));
    }

    @Transactional(readOnly = true)
    public List<AttendanceResponse> memberHistory(Long callerId, Long memberUserId) {
        CrmPrincipal crm = crmAccessService.requireStaff(callerId);
        requireMemberInGym(memberUserId, crm.gymId());
        return responses(classAttendanceRepository.findAttendedForUserInGym(crm.gymId(), memberUserId));
    }

    @Transactional(readOnly = true)
    public List<AccessEventReviewResponse> unresolvedAccessEvents(Long callerId) {
        CrmPrincipal crm = crmAccessService.requireStaff(callerId);
        List<RawAccessEvent> events = rawAccessEventRepository
                .findAllByGymIdAndStatusInOrderByEventTimeDescIdDesc(crm.gymId(), REVIEWABLE_ACCESS_STATUSES);
        return accessEventResponses(events);
    }

    @Transactional
    public AccessEventReviewResponse linkMember(Long callerId, Long eventId, Long memberUserId) {
        CrmPrincipal crm = crmAccessService.requireStaff(callerId);
        RawAccessEvent event = requireAccessEventInGym(eventId, crm.gymId());
        requireReviewable(event);
        requireMemberInGym(memberUserId, crm.gymId());

        event.setStudentUserId(memberUserId);
        event.setStatus(AccessEventStatus.RECEIVED);
        event.setProcessed(false);
        event.setProcessedAt(null);
        event.setMatchedClassId(null);
        rawAccessEventRepository.save(event);
        accessEventProcessor.reprocess(eventId);
        return accessEventResponse(rawAccessEventRepository.findById(eventId).orElseThrow());
    }

    @Transactional
    public AccessEventReviewResponse markIgnored(Long callerId, Long eventId) {
        CrmPrincipal crm = crmAccessService.requireStaff(callerId);
        RawAccessEvent event = requireAccessEventInGym(eventId, crm.gymId());
        requireReviewable(event);
        event.setStatus(AccessEventStatus.IGNORED);
        event.setProcessed(true);
        event.setProcessedAt(Instant.now());
        return accessEventResponse(rawAccessEventRepository.save(event));
    }

    @Transactional
    public AccessEventReviewResponse assignClass(Long callerId, Long eventId, Long classId) {
        CrmPrincipal crm = crmAccessService.requireStaff(callerId);
        RawAccessEvent event = requireAccessEventInGym(eventId, crm.gymId());
        if (!REVIEWABLE_ACCESS_STATUSES.contains(event.getStatus())
                && event.getStatus() != AccessEventStatus.PROCESSED_GYM_VISIT) {
            throw new ApiException(HttpStatus.CONFLICT, "ACCESS_EVENT_NOT_REVIEWABLE",
                    "Access event is not available for reconciliation");
        }
        GymClass gymClass = requireClassInGym(classId, crm.gymId());
        if (event.getStudentUserId() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "UNRESOLVED_MEMBER",
                    "Link the access event to a member first");
        }
        requireMemberInGym(event.getStudentUserId(), crm.gymId());
        accessEventProcessor.assignClass(eventId, gymClass.getId(), callerId);
        return accessEventResponse(rawAccessEventRepository.findById(eventId).orElseThrow());
    }

    private List<AttendanceResponse> responses(List<ClassAttendance> rows) {
        if (rows.isEmpty()) {
            return List.of();
        }
        Map<Long, GymClass> classes = gymClassRepository
                .findAllById(rows.stream().map(ClassAttendance::getGymClassId).distinct().toList()).stream()
                .collect(Collectors.toMap(GymClass::getId, Function.identity()));
        Map<Long, User> users = userRepository
                .findAllById(rows.stream().map(ClassAttendance::getUserId).distinct().toList()).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));

        return rows.stream().map(row -> {
            GymClass gymClass = classes.get(row.getGymClassId());
            User user = users.get(row.getUserId());
            return new AttendanceResponse(
                    row.getId(),
                    row.getGymClassId(),
                    gymClass == null ? null : gymClass.getName(),
                    row.getClassDate(),
                    row.getUserId(),
                    user == null ? null : user.getDisplayName(),
                    row.getStatus(),
                    row.getMarkedByUserId());
        }).toList();
    }

    private List<AccessEventReviewResponse> accessEventResponses(List<RawAccessEvent> events) {
        if (events.isEmpty()) {
            return List.of();
        }
        Map<Long, AccessDevice> devices = accessDeviceRepository
                .findAllById(events.stream().map(RawAccessEvent::getDeviceId).distinct().toList()).stream()
                .collect(Collectors.toMap(AccessDevice::getId, Function.identity()));
        Map<Long, User> users = userRepository.findAllById(events.stream()
                .map(RawAccessEvent::getStudentUserId).filter(id -> id != null).distinct().toList()).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        return events.stream().map(event -> accessEventResponse(event, devices, users)).toList();
    }

    private AccessEventReviewResponse accessEventResponse(RawAccessEvent event) {
        AccessDevice device = accessDeviceRepository.findById(event.getDeviceId()).orElse(null);
        User user = event.getStudentUserId() == null ? null
                : userRepository.findById(event.getStudentUserId()).orElse(null);
        return accessEventResponse(event,
                device == null ? Map.of() : Map.of(device.getId(), device),
                user == null ? Map.of() : Map.of(user.getId(), user));
    }

    private static AccessEventReviewResponse accessEventResponse(RawAccessEvent event,
            Map<Long, AccessDevice> devices, Map<Long, User> users) {
        AccessDevice device = devices.get(event.getDeviceId());
        User user = users.get(event.getStudentUserId());
        return new AccessEventReviewResponse(
                event.getId(),
                event.getDeviceId(),
                device == null ? null : device.getName(),
                event.getStudentUserId(),
                user == null ? null : user.getDisplayName(),
                event.getExternalMemberId(),
                event.getEventTime(),
                event.getSource().name(),
                event.getStatus().name(),
                Boolean.TRUE.equals(event.getProcessed()),
                event.getMatchedClassId(),
                event.getNotes());
    }

    private GymClass requireClassInGym(Long classId, Long gymId) {
        GymClass gymClass = gymClassRepository.findById(classId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "CLASS_NOT_FOUND", "Class not found"));
        if (!gymId.equals(gymClass.getGymId())) {
            throw new ApiException(HttpStatus.NOT_FOUND, "CLASS_NOT_FOUND", "Class not found");
        }
        return gymClass;
    }

    private RawAccessEvent requireAccessEventInGym(Long eventId, Long gymId) {
        RawAccessEvent event = rawAccessEventRepository.findById(eventId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ACCESS_EVENT_NOT_FOUND",
                        "Access event not found"));
        if (!gymId.equals(event.getGymId())) {
            throw new ApiException(HttpStatus.NOT_FOUND, "ACCESS_EVENT_NOT_FOUND", "Access event not found");
        }
        return event;
    }

    private static void requireReviewable(RawAccessEvent event) {
        if (!REVIEWABLE_ACCESS_STATUSES.contains(event.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "ACCESS_EVENT_NOT_REVIEWABLE",
                    "Access event is not available for reconciliation");
        }
    }

    private void requireMemberInGym(Long userId, Long gymId) {
        if (gymMemberRepository.findByGymIdAndUserId(gymId, userId).isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "Member not found");
        }
    }

    private static String requestedStatus(MarkAttendanceRequest request) {
        if (request.status() == null || request.status().isBlank()) {
            if (request.present() == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "ATTENDANCE_STATUS_REQUIRED",
                        "status or present is required");
            }
            return request.present() ? "PRESENT" : "REMOVED";
        }
        String status = request.status().trim().toUpperCase(Locale.ROOT);
        if (!status.equals("PRESENT") && !status.equals("ABSENT") && !status.equals("LATE")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ATTENDANCE_STATUS",
                    "status must be PRESENT, ABSENT, or LATE");
        }
        return status;
    }
}
