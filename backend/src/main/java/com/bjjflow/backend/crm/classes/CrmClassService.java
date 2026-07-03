package com.bjjflow.backend.crm.classes;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.classes.GymClass;
import com.bjjflow.backend.classes.GymClassRepository;
import com.bjjflow.backend.classes.RestrictionMode;
import com.bjjflow.backend.classes.SessionType;
import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.crm.classes.CrmClassDtos.ClassResponse;
import com.bjjflow.backend.crm.classes.CrmClassDtos.CreateClassRequest;
import com.bjjflow.backend.crm.classes.CrmClassDtos.UpdateClassRequest;
import com.bjjflow.backend.crm.security.CrmAccessService;
import com.bjjflow.backend.crm.security.CrmPrincipal;
import com.bjjflow.backend.gyms.GymMember;
import com.bjjflow.backend.gyms.GymMemberRepository;
import com.bjjflow.backend.gyms.GymRole;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CrmClassService {

    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HH:mm");

    private final CrmAccessService crmAccessService;
    private final GymClassRepository gymClassRepository;
    private final GymMemberRepository gymMemberRepository;

    @Transactional(readOnly = true)
    public List<ClassResponse> list(Long userId) {
        CrmPrincipal crm = crmAccessService.requireStaff(userId);
        return gymClassRepository.findAllByGymIdOrderByDayOfWeekAscStartTimeAsc(crm.gymId()).stream()
                .map(this::response)
                .toList();
    }

    @Transactional
    public ClassResponse create(Long userId, CreateClassRequest request) {
        CrmPrincipal crm = crmAccessService.requireStaff(userId);
        validateInstructor(crm.gymId(), request.instructorUserId());

        LocalTime startTime = parseTime(request.startTime());
        LocalTime endTime = parseTime(request.endTime());
        validateTimeRange(startTime, endTime);

        GymClass gymClass = new GymClass();
        gymClass.setGymId(crm.gymId());
        gymClass.setName(request.name().trim());
        gymClass.setSessionType(parseSessionType(request.sessionType()));
        gymClass.setDayOfWeek(request.dayOfWeek());
        gymClass.setStartTime(startTime);
        gymClass.setEndTime(endTime);
        gymClass.setInstructorUserId(request.instructorUserId());
        gymClass.setRestrictionMode(RestrictionMode.ALL);
        gymClass.setActive(true);

        return response(gymClassRepository.save(gymClass));
    }

    @Transactional
    public ClassResponse update(Long userId, Long classId, UpdateClassRequest request) {
        CrmPrincipal crm = crmAccessService.requireStaff(userId);
        GymClass gymClass = classInGym(classId, crm.gymId());

        if (request.name() != null) {
            if (request.name().isBlank() || request.name().length() > 100) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CLASS_NAME", "Class name is invalid");
            }
            gymClass.setName(request.name().trim());
        }
        if (request.sessionType() != null) {
            gymClass.setSessionType(parseSessionType(request.sessionType()));
        }
        if (request.dayOfWeek() != null) {
            if (request.dayOfWeek() < 1 || request.dayOfWeek() > 7) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DAY_OF_WEEK",
                        "dayOfWeek must be between 1 and 7");
            }
            gymClass.setDayOfWeek(request.dayOfWeek());
        }

        LocalTime startTime = request.startTime() == null ? gymClass.getStartTime() : parseTime(request.startTime());
        LocalTime endTime = request.endTime() == null ? gymClass.getEndTime() : parseTime(request.endTime());
        validateTimeRange(startTime, endTime);
        gymClass.setStartTime(startTime);
        gymClass.setEndTime(endTime);

        if (request.instructorUserId() != null) {
            validateInstructor(crm.gymId(), request.instructorUserId());
            gymClass.setInstructorUserId(request.instructorUserId());
        }
        if (request.active() != null) {
            gymClass.setActive(request.active());
        }

        return response(gymClassRepository.save(gymClass));
    }

    @Transactional
    public void delete(Long userId, Long classId) {
        CrmPrincipal crm = crmAccessService.requireStaff(userId);
        GymClass gymClass = classInGym(classId, crm.gymId());
        gymClass.setActive(false);
        gymClassRepository.save(gymClass);
    }

    private GymClass classInGym(Long classId, Long gymId) {
        GymClass gymClass = gymClassRepository.findById(classId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "CLASS_NOT_FOUND", "Class not found"));
        if (!gymId.equals(gymClass.getGymId())) {
            throw new ApiException(HttpStatus.NOT_FOUND, "CLASS_NOT_FOUND", "Class not found");
        }
        return gymClass;
    }

    private void validateInstructor(Long gymId, Long instructorUserId) {
        if (instructorUserId == null) {
            return;
        }
        GymMember instructor = gymMemberRepository.findByGymIdAndUserId(gymId, instructorUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INSTRUCTOR",
                        "Instructor must belong to this gym"));
        if (instructor.getRole() == GymRole.MEMBER) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INSTRUCTOR",
                    "Instructor must be gym staff");
        }
    }

    private ClassResponse response(GymClass gymClass) {
        return new ClassResponse(
                gymClass.getId(),
                gymClass.getName(),
                gymClass.getSessionType().name(),
                gymClass.getDayOfWeek(),
                gymClass.getStartTime().format(TIME_FORMAT),
                gymClass.getEndTime().format(TIME_FORMAT),
                gymClass.getInstructorUserId(),
                Boolean.TRUE.equals(gymClass.getActive()));
    }

    private static SessionType parseSessionType(String value) {
        try {
            return SessionType.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_SESSION_TYPE", "Invalid session type");
        }
    }

    private static LocalTime parseTime(String value) {
        try {
            return LocalTime.parse(value, TIME_FORMAT);
        } catch (DateTimeParseException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_TIME", "Time must use HH:mm format");
        }
    }

    private static void validateTimeRange(LocalTime startTime, LocalTime endTime) {
        if (!endTime.isAfter(startTime)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_TIME", "End time must be after start time");
        }
    }
}
