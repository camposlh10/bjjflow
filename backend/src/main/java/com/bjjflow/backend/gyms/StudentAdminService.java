package com.bjjflow.backend.gyms;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.auth.AuthDtos.BeltDto;
import com.bjjflow.backend.belts.BeltPromotion;
import com.bjjflow.backend.belts.BeltPromotionRepository;
import com.bjjflow.backend.belts.BeltRank;
import com.bjjflow.backend.belts.BeltRankRepository;
import com.bjjflow.backend.classes.ClassAttendanceRepository;
import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.gyms.StudentAdminDtos.AttendanceDto;
import com.bjjflow.backend.gyms.StudentAdminDtos.CreateNoteRequest;
import com.bjjflow.backend.gyms.StudentAdminDtos.GraduationDto;
import com.bjjflow.backend.gyms.StudentAdminDtos.NoteDto;
import com.bjjflow.backend.gyms.StudentAdminDtos.PromotionDto;
import com.bjjflow.backend.gyms.StudentAdminDtos.StudentAdminDto;
import com.bjjflow.backend.pain.PainAssessmentDtos.AssessmentDto;
import com.bjjflow.backend.pain.PainAssessmentDtos.AssessmentSummaryDto;
import com.bjjflow.backend.pain.PainAssessmentService;
import com.bjjflow.backend.storage.MediaStorage;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserBeltProgress;
import com.bjjflow.backend.users.UserBeltProgressRepository;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class StudentAdminService {

    private final GymMemberRepository gymMemberRepository;
    private final GymRepository gymRepository;
    private final UserRepository userRepository;
    private final UserBeltProgressRepository beltProgressRepository;
    private final BeltPromotionRepository beltPromotionRepository;
    private final BeltRankRepository beltRankRepository;
    private final ClassAttendanceRepository classAttendanceRepository;
    private final GymStudentNoteRepository noteRepository;
    private final PainAssessmentService painAssessmentService;
    private final MediaStorage mediaStorage;

    @Transactional(readOnly = true)
    public StudentAdminDto student(Long callerId, Long studentUserId) {
        GymMember caller = requireStaff(callerId);
        Long gymId = caller.getGymId();
        GymMember membership = requireMember(gymId, studentUserId);
        User student = userRepository.findById(studentUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"));

        // Prefer the belt this gym assigned the student; fall back to their profile
        // belt when the gym hasn't graded them yet (or when belt sync is on, both match).
        BeltDto belt;
        if (membership.getBeltRankId() != null) {
            BeltRank r = beltRankRepository.findById(membership.getBeltRankId()).orElse(null);
            belt = r == null ? null : beltOf(r, membership.getStripes() == null ? 0 : membership.getStripes());
        } else {
            belt = beltProgressRepository.findByUserId(studentUserId).map(StudentAdminService::beltOf).orElse(null);
        }

        // Graduation counter: PRESENT class attendances since the last promotion (or ever).
        BeltPromotion lastPromo = beltPromotionRepository.findFirstByUserIdOrderByCreatedAtDesc(studentUserId)
                .orElse(null);
        Instant since = lastPromo == null ? Instant.EPOCH : lastPromo.getCreatedAt();
        long classesSince = classAttendanceRepository.countForUserInGymSince(gymId, studentUserId, since);
        int target = gymRepository.findById(gymId).map(Gym::getGraduationTarget).orElse(40);
        Instant beltStart = lastPromo != null ? lastPromo.getCreatedAt() : membership.getJoinedAt();
        Long daysInBelt = beltStart == null ? null : ChronoUnit.DAYS.between(beltStart, Instant.now());
        GraduationDto graduation = new GraduationDto(classesSince, target, classesSince >= target, daysInBelt,
                lastPromo == null ? null : lastPromo.getCreatedAt());

        long total = classAttendanceRepository.countForUserInGymSince(gymId, studentUserId, Instant.EPOCH);
        long last30 = classAttendanceRepository.countForUserInGymSince(gymId, studentUserId,
                Instant.now().minus(30, ChronoUnit.DAYS));
        AttendanceDto attendance = new AttendanceDto(total, last30,
                classAttendanceRepository.lastAttendedInGym(gymId, studentUserId), membership.getJoinedAt());

        List<PromotionDto> history = promotionHistory(gymId, studentUserId);
        List<StudentAdminDtos.AttendanceEntryDto> recentAttendance = classAttendanceRepository
                .recentAttendanceInGym(gymId, studentUserId, org.springframework.data.domain.PageRequest.of(0, 20))
                .stream()
                .map(row -> new StudentAdminDtos.AttendanceEntryDto((java.time.LocalDate) row[0], (String) row[1]))
                .toList();

        return new StudentAdminDto(
                student.getId(),
                student.getUsername(),
                student.getDisplayName(),
                student.getAvatarKey() == null ? null : mediaStorage.urlFor(student.getAvatarKey()),
                Boolean.TRUE.equals(student.getPro()),
                membership.getRole().name(),
                belt,
                graduation,
                attendance,
                history,
                recentAttendance);
    }

    private List<PromotionDto> promotionHistory(Long gymId, Long studentUserId) {
        List<BeltPromotion> promos = beltPromotionRepository.findAllByUserIdOrderByCreatedAtDesc(studentUserId).stream()
                .filter(p -> gymId.equals(p.getGymId()))
                .toList();
        if (promos.isEmpty()) {
            return List.of();
        }
        Map<Long, BeltRank> ranks = beltRankRepository
                .findAllById(promos.stream().map(BeltPromotion::getBeltRankId).toList()).stream()
                .collect(Collectors.toMap(BeltRank::getId, Function.identity()));
        return promos.stream().map(p -> {
            BeltRank r = ranks.get(p.getBeltRankId());
            return new PromotionDto(
                    r == null ? null : r.getSlug(),
                    r == null ? "—" : r.getNamePt(),
                    r == null ? "#999999" : r.getColorHex(),
                    p.getStripes() == null ? 0 : p.getStripes(),
                    p.getCreatedAt());
        }).toList();
    }

    @Transactional(readOnly = true)
    public List<NoteDto> notes(Long callerId, Long studentUserId) {
        GymMember caller = requireStaff(callerId);
        requireMember(caller.getGymId(), studentUserId);
        List<GymStudentNote> notes = noteRepository
                .findAllByGymIdAndStudentUserIdOrderByCreatedAtDesc(caller.getGymId(), studentUserId);
        if (notes.isEmpty()) {
            return List.of();
        }
        Map<Long, String> authors = userRepository
                .findAllById(notes.stream().map(GymStudentNote::getAuthorUserId).distinct().toList()).stream()
                .collect(Collectors.toMap(User::getId, User::getDisplayName));
        return notes.stream()
                .map(n -> new NoteDto(n.getId(), authors.getOrDefault(n.getAuthorUserId(), "—"), n.getContent(),
                        n.getCreatedAt()))
                .toList();
    }

    /** Staff-only: a student's 5 most recent pain assessments (for graduation decisions). */
    @Transactional(readOnly = true)
    public List<AssessmentSummaryDto> painAssessments(Long callerId, Long studentUserId) {
        GymMember caller = requireStaff(callerId);
        requireMember(caller.getGymId(), studentUserId);
        return painAssessmentService.list(studentUserId, 5);
    }

    /** Staff-only: full detail of one of a student's pain assessments. */
    @Transactional(readOnly = true)
    public AssessmentDto painAssessment(Long callerId, Long studentUserId, Long assessmentId) {
        GymMember caller = requireStaff(callerId);
        requireMember(caller.getGymId(), studentUserId);
        return painAssessmentService.get(studentUserId, assessmentId);
    }

    @Transactional
    public NoteDto addNote(Long callerId, Long studentUserId, CreateNoteRequest request) {
        GymMember caller = requireStaff(callerId);
        requireMember(caller.getGymId(), studentUserId);
        GymStudentNote note = new GymStudentNote();
        note.setGymId(caller.getGymId());
        note.setStudentUserId(studentUserId);
        note.setAuthorUserId(callerId);
        note.setContent(request.content().trim());
        note = noteRepository.save(note);
        String authorName = userRepository.findById(callerId).map(User::getDisplayName).orElse("—");
        return new NoteDto(note.getId(), authorName, note.getContent(), note.getCreatedAt());
    }

    @Transactional
    public void deleteNote(Long callerId, Long noteId) {
        GymMember caller = requireStaff(callerId);
        GymStudentNote note = noteRepository.findByIdAndGymId(noteId, caller.getGymId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOTE_NOT_FOUND", "Note not found"));
        boolean isAuthor = note.getAuthorUserId().equals(callerId);
        boolean isOwner = caller.getRole() == GymRole.OWNER;
        if (!isAuthor && !isOwner) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_ALLOWED", "Only the author or owner can delete this note");
        }
        noteRepository.delete(note);
    }

    private GymMember requireStaff(Long callerId) {
        GymMember caller = gymMemberRepository.findFirstByUserId(callerId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NO_GYM", "You are not in a gym"));
        if (caller.getRole() == GymRole.MEMBER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_STAFF", "Only instructors can manage students");
        }
        return caller;
    }

    private GymMember requireMember(Long gymId, Long studentUserId) {
        return gymMemberRepository.findByGymIdAndUserId(gymId, studentUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "NOT_A_MEMBER",
                        "That user is not in this gym"));
    }

    private static BeltDto beltOf(UserBeltProgress p) {
        return beltOf(p.getBeltRank(), p.getStripes());
    }

    private static BeltDto beltOf(BeltRank r, int stripes) {
        return new BeltDto(r.getSlug(), r.getName(), r.getNamePt(), r.getColorHex(), stripes);
    }
}
