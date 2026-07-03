package com.bjjflow.backend.classes;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.belts.BeltRankRepository;
import com.bjjflow.backend.checkins.CheckInService;
import com.bjjflow.backend.classes.ClassDtos.AgendaOccurrenceDto;
import com.bjjflow.backend.classes.ClassDtos.AttendeeDto;
import com.bjjflow.backend.classes.ClassDtos.ClassDto;
import com.bjjflow.backend.classes.ClassDtos.CreateClassRequest;
import com.bjjflow.backend.classes.ClassDtos.RosterEntryDto;
import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.gyms.GymDtos.BeltSummary;
import com.bjjflow.backend.gyms.GymMember;
import com.bjjflow.backend.gyms.GymMemberRepository;
import com.bjjflow.backend.gyms.GymRole;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserBeltProgress;
import com.bjjflow.backend.users.UserBeltProgressRepository;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ClassService {

    private static final DateTimeFormatter HM = DateTimeFormatter.ofPattern("HH:mm");
    private static final int MAX_RANGE_DAYS = 14;

    private final GymClassRepository classRepository;
    private final ClassAttendanceRepository attendanceRepository;
    private final GymMemberRepository gymMemberRepository;
    private final UserRepository userRepository;
    private final UserBeltProgressRepository beltProgressRepository;
    private final BeltRankRepository beltRankRepository;
    private final CheckInService checkInService;

    @Transactional
    public ClassDto createClass(Long userId, CreateClassRequest req) {
        GymMember membership = requireStaff(userId);

        LocalTime start = parseTime(req.startTime());
        LocalTime end = parseTime(req.endTime());
        if (!end.isAfter(start)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_TIME", "End time must be after start time");
        }
        SessionType type = parseEnum(SessionType.class, req.sessionType(), "INVALID_SESSION_TYPE");
        RestrictionMode mode = req.restrictionMode() == null || req.restrictionMode().isBlank()
                ? RestrictionMode.ALL
                : parseEnum(RestrictionMode.class, req.restrictionMode(), "INVALID_RESTRICTION");

        GymClass gc = new GymClass();
        gc.setGymId(membership.getGymId());
        gc.setName(req.name().trim());
        gc.setInstructorUserId(req.instructorUserId());
        gc.setDayOfWeek(req.dayOfWeek());
        gc.setStartTime(start);
        gc.setEndTime(end);
        gc.setSessionType(type);
        gc.setRestrictionMode(mode);
        gc.setAllowedBeltSlugs(mode == RestrictionMode.BELTS && req.allowedBeltSlugs() != null
                ? String.join(",", req.allowedBeltSlugs())
                : null);
        gc = classRepository.save(gc);
        return toClassDto(gc);
    }

    @Transactional
    public void deleteClass(Long userId, Long classId) {
        GymMember membership = requireStaff(userId);
        GymClass gc = classInGym(classId, membership.getGymId());
        // Soft delete keeps past attendance for the graduation counter.
        gc.setActive(false);
        classRepository.save(gc);
    }

    @Transactional(readOnly = true)
    public List<ClassDto> listClasses(Long userId) {
        GymMember membership = requireMembership(userId);
        return classRepository.findAllByGymIdAndActiveTrueOrderByDayOfWeekAscStartTimeAsc(membership.getGymId())
                .stream().map(this::toClassDto).toList();
    }

    @Transactional(readOnly = true)
    public List<AgendaOccurrenceDto> agenda(Long userId, LocalDate from, LocalDate to) {
        GymMember membership = requireMembership(userId);
        if (to.isBefore(from)) {
            return List.of();
        }
        if (to.isAfter(from.plusDays(MAX_RANGE_DAYS - 1))) {
            to = from.plusDays(MAX_RANGE_DAYS - 1);
        }
        User user = userRepository.findById(userId).orElseThrow();
        String beltSlug = beltSlugOf(userId);

        List<GymClass> classes = classRepository
                .findAllByGymIdAndActiveTrueOrderByDayOfWeekAscStartTimeAsc(membership.getGymId());

        // Batched lookups: O(1) queries for the whole range instead of two per
        // class-day occurrence (my attendance rows + per-occurrence counts).
        Map<String, String> myStatus = new HashMap<>();
        for (ClassAttendance a : attendanceRepository.findAllByUserIdAndClassDateBetween(userId, from, to)) {
            myStatus.put(a.getGymClassId() + "|" + a.getClassDate(), a.getStatus());
        }
        Map<String, Long> counts = new HashMap<>();
        for (Object[] row : attendanceRepository.countsBetween(from, to)) {
            counts.put(row[0] + "|" + row[1], (Long) row[2]);
        }

        List<AgendaOccurrenceDto> out = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            int dow = d.getDayOfWeek().getValue();
            for (GymClass gc : classes) {
                if (gc.getDayOfWeek() != dow) {
                    continue;
                }
                String key = gc.getId() + "|" + d;
                out.add(buildOccurrence(gc, d, user.getAge(), beltSlug,
                        myStatus.get(key), counts.getOrDefault(key, 0L)));
            }
        }
        out.sort(Comparator.comparing(AgendaOccurrenceDto::date)
                .thenComparing(AgendaOccurrenceDto::startTime));
        return out;
    }

    @Transactional
    public AgendaOccurrenceDto reserve(Long userId, Long classId, LocalDate date) {
        GymMember membership = requireMembership(userId);
        GymClass gc = classInGym(classId, membership.getGymId());
        User user = userRepository.findById(userId).orElseThrow();

        if (!eligible(gc, user.getAge(), beltSlugOf(userId))) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_ELIGIBLE", "You can't attend this class");
        }
        if (date.isBefore(LocalDate.now())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DATE", "Cannot reserve a past class");
        }
        var existing = attendanceRepository.findByGymClassIdAndClassDateAndUserId(gc.getId(), date, userId);
        if (existing.isPresent()) {
            // Toggling an existing reservation cancels it; PRESENT stays untouched.
            if ("RESERVED".equals(existing.get().getStatus())) {
                attendanceRepository.delete(existing.get());
            }
        } else {
            createAttendance(gc.getId(), date, userId, userId, "RESERVED");
        }
        return occurrence(gc, date, userId, user.getAge(), beltSlugOf(userId));
    }

    @Transactional
    public AgendaOccurrenceDto checkIn(Long userId, Long classId, LocalDate date) {
        GymMember membership = requireMembership(userId);
        GymClass gc = classInGym(classId, membership.getGymId());
        User user = userRepository.findById(userId).orElseThrow();

        if (!eligible(gc, user.getAge(), beltSlugOf(userId))) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_ELIGIBLE", "You can't attend this class");
        }
        if (!withinWindow(gc, date)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "CHECKIN_NOT_OPEN",
                    "Check-in is not open for this class");
        }
        var existing = attendanceRepository.findByGymClassIdAndClassDateAndUserId(gc.getId(), date, userId);
        if (existing.isPresent()) {
            ClassAttendance a = existing.get();
            if (!"PRESENT".equals(a.getStatus())) {
                // A reservation converts into verified attendance on check-in
                a.setStatus("PRESENT");
                a.setMarkedByUserId(userId);
                attendanceRepository.save(a);
                checkInService.ensureDailyCheckIn(userId, date);
            }
        } else {
            createAttendance(gc.getId(), date, userId, userId, "PRESENT");
            checkInService.ensureDailyCheckIn(userId, date);
        }
        return occurrence(gc, date, userId, user.getAge(), beltSlugOf(userId));
    }

    @Transactional(readOnly = true)
    public List<AttendeeDto> attendees(Long userId, Long classId, LocalDate date) {
        GymMember membership = requireMembership(userId);
        GymClass gc = classInGym(classId, membership.getGymId());
        return attendanceRepository.findAllByGymClassIdAndClassDate(gc.getId(), date).stream()
                .map(a -> new AttendeeDto(a.getUserId(), displayName(a.getUserId()),
                        beltSummary(a.getUserId()), a.getStatus()))
                .sorted(Comparator
                        .comparing((AttendeeDto a) -> isAttended(a.status()) ? 0 : 1)
                        .thenComparing(AttendeeDto::displayName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RosterEntryDto> roster(Long userId, Long classId, LocalDate date) {
        GymMember membership = requireStaff(userId);
        GymClass gc = classInGym(classId, membership.getGymId());
        Set<Long> present = attendanceRepository.findAllByGymClassIdAndClassDate(gc.getId(), date).stream()
                .filter(a -> isAttended(a.getStatus()))
                .map(ClassAttendance::getUserId).collect(Collectors.toSet());
        return gymMemberRepository.findAllByGymId(membership.getGymId()).stream()
                .map(m -> new RosterEntryDto(m.getUserId(), displayName(m.getUserId()),
                        beltSummary(m.getUserId()), present.contains(m.getUserId())))
                .sorted(Comparator.comparing(RosterEntryDto::displayName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    @Transactional
    public void markAttendance(Long userId, Long classId, LocalDate date, Long targetUserId, boolean present) {
        GymMember membership = requireStaff(userId);
        GymClass gc = classInGym(classId, membership.getGymId());
        if (gymMemberRepository.findByGymIdAndUserId(membership.getGymId(), targetUserId).isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "NOT_A_MEMBER", "That user is not in this gym");
        }
        if (present) {
            var existing = attendanceRepository
                    .findByGymClassIdAndClassDateAndUserId(gc.getId(), date, targetUserId);
            if (existing.isPresent()) {
                ClassAttendance a = existing.get();
                if (!"PRESENT".equals(a.getStatus())) {
                    a.setStatus("PRESENT");
                    a.setMarkedByUserId(userId);
                    attendanceRepository.save(a);
                    checkInService.ensureDailyCheckIn(targetUserId, date);
                }
            } else {
                createAttendance(gc.getId(), date, targetUserId, userId, "PRESENT");
                checkInService.ensureDailyCheckIn(targetUserId, date);
            }
        } else {
            attendanceRepository.deleteByGymClassIdAndClassDateAndUserId(gc.getId(), date, targetUserId);
        }
    }

    // --- helpers ---

    private AgendaOccurrenceDto occurrence(GymClass gc, LocalDate date, Long userId, Integer age, String beltSlug) {
        String status = attendanceRepository
                .findByGymClassIdAndClassDateAndUserId(gc.getId(), date, userId)
                .map(ClassAttendance::getStatus)
                .orElse(null);
        return buildOccurrence(gc, date, age, beltSlug, status,
                attendanceRepository.countByGymClassIdAndClassDate(gc.getId(), date));
    }

    private AgendaOccurrenceDto buildOccurrence(GymClass gc, LocalDate date, Integer age, String beltSlug,
            String myStatus, long attendeeCount) {
        boolean eligible = eligible(gc, age, beltSlug);
        boolean checkedIn = isAttended(myStatus);
        boolean reserved = "RESERVED".equals(myStatus);
        boolean canCheckIn = eligible && !checkedIn && withinWindow(gc, date);
        boolean canReserve = eligible && !checkedIn && !reserved && date.isAfter(LocalDate.now());
        return new AgendaOccurrenceDto(gc.getId(), gc.getName(), instructorName(gc.getInstructorUserId()),
                gc.getSessionType().name(), gc.getStartTime().format(HM), gc.getEndTime().format(HM),
                date, restrictionLabel(gc), eligible, checkedIn, canCheckIn, reserved, canReserve, attendeeCount);
    }

    private void createAttendance(Long classId, LocalDate date, Long userId, Long markedBy, String status) {
        ClassAttendance a = new ClassAttendance();
        a.setGymClassId(classId);
        a.setClassDate(date);
        a.setUserId(userId);
        a.setStatus(status);
        a.setMarkedByUserId(markedBy);
        attendanceRepository.save(a);
    }

    private static boolean isAttended(String status) {
        return "PRESENT".equals(status) || "LATE".equals(status);
    }

    private boolean withinWindow(GymClass gc, LocalDate date) {
        if (!date.equals(LocalDate.now())) {
            return false;
        }
        // Opens 1h before class; clamp to midnight for early classes so the
        // subtraction doesn't wrap past the previous day.
        LocalTime open = gc.getStartTime().isBefore(LocalTime.of(1, 0))
                ? LocalTime.MIN
                : gc.getStartTime().minusHours(1);
        return !LocalTime.now().isBefore(open);
    }

    private boolean eligible(GymClass gc, Integer age, String beltSlug) {
        return switch (gc.getRestrictionMode()) {
            case ALL -> true;
            case KIDS -> age != null && age < 16;
            case ADULTS -> age != null && age >= 16;
            case BELTS -> beltSlug != null && gc.getAllowedBeltSlugs() != null
                    && Arrays.asList(gc.getAllowedBeltSlugs().split(",")).contains(beltSlug);
        };
    }

    private String restrictionLabel(GymClass gc) {
        return switch (gc.getRestrictionMode()) {
            case ALL -> null;
            case KIDS -> "Só kids";
            case ADULTS -> "Só adultos";
            case BELTS -> beltRestrictionLabel(gc.getAllowedBeltSlugs());
        };
    }

    private String beltRestrictionLabel(String slugs) {
        if (slugs == null || slugs.isBlank()) {
            return "Restrito";
        }
        List<String> names = Arrays.stream(slugs.split(","))
                .map(s -> beltRankRepository.findBySlug(s).map(b -> b.getNamePt()).orElse(null))
                .filter(n -> n != null)
                .toList();
        if (names.isEmpty()) {
            return "Restrito";
        }
        if (names.size() == 1) {
            return "Faixa " + names.get(0);
        }
        return String.join(" / ", names);
    }

    private ClassDto toClassDto(GymClass gc) {
        return new ClassDto(gc.getId(), gc.getName(), instructorName(gc.getInstructorUserId()),
                gc.getDayOfWeek(), gc.getStartTime().format(HM), gc.getEndTime().format(HM),
                gc.getSessionType().name(), gc.getRestrictionMode().name(), restrictionLabel(gc));
    }

    private GymMember requireMembership(Long userId) {
        return gymMemberRepository.findFirstByUserId(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NO_GYM", "You are not in a gym"));
    }

    private GymMember requireStaff(Long userId) {
        GymMember m = requireMembership(userId);
        if (m.getRole() == GymRole.MEMBER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_STAFF", "Only instructors can do this");
        }
        return m;
    }

    private GymClass classInGym(Long classId, Long gymId) {
        GymClass gc = classRepository.findById(classId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "CLASS_NOT_FOUND", "Class not found"));
        if (!gc.getGymId().equals(gymId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "CLASS_NOT_FOUND", "Class not found");
        }
        return gc;
    }

    private String instructorName(Long instructorUserId) {
        return instructorUserId == null ? null : displayName(instructorUserId);
    }

    private String displayName(Long userId) {
        return userRepository.findById(userId).map(User::getDisplayName).orElse("—");
    }

    private String beltSlugOf(Long userId) {
        return beltProgressRepository.findByUserId(userId)
                .map(p -> p.getBeltRank().getSlug()).orElse(null);
    }

    private BeltSummary beltSummary(Long userId) {
        return beltProgressRepository.findByUserId(userId).map(this::toBeltSummary).orElse(null);
    }

    private BeltSummary toBeltSummary(UserBeltProgress progress) {
        var rank = progress.getBeltRank();
        return new BeltSummary(rank.getSlug(), rank.getNamePt(), rank.getColorHex(), progress.getStripes());
    }

    private LocalTime parseTime(String value) {
        try {
            return LocalTime.parse(value.trim());
        } catch (Exception e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_TIME", "Time must be HH:mm");
        }
    }

    private <E extends Enum<E>> E parseEnum(Class<E> type, String value, String errorCode) {
        try {
            return Enum.valueOf(type, value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, errorCode, "Invalid value: " + value);
        }
    }
}
