package com.bjjflow.backend.kids;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.belts.BeltRankRepository;
import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.crm.security.CrmAccessService;
import com.bjjflow.backend.crm.security.CrmPrincipal;
import com.bjjflow.backend.gyms.Gym;
import com.bjjflow.backend.gyms.GymMember;
import com.bjjflow.backend.gyms.GymMemberRepository;
import com.bjjflow.backend.gyms.GymRepository;
import com.bjjflow.backend.gyms.GymRole;
import com.bjjflow.backend.kids.KidsDtos.ChildSummaryDto;
import com.bjjflow.backend.kids.KidsDtos.CreateChildRequest;
import com.bjjflow.backend.kids.KidsDtos.FamilyResponse;
import com.bjjflow.backend.kids.KidsDtos.GuardianDto;
import com.bjjflow.backend.kids.KidsDtos.GuardianRequest;
import com.bjjflow.backend.kids.KidsDtos.HealthDto;
import com.bjjflow.backend.kids.KidsDtos.HealthRequest;
import com.bjjflow.backend.kids.KidsDtos.PickupDto;
import com.bjjflow.backend.kids.KidsDtos.PickupRequest;
import com.bjjflow.backend.kids.KidsDtos.RecordDocumentRequest;
import com.bjjflow.backend.kids.KidsDtos.StudentDocumentDto;
import com.bjjflow.backend.kids.KidsDtos.UpdateBasicsRequest;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * A child's family record, kept by the gym's staff: guardians, who may collect
 * the child, the emergency card and signed documents. Guardians link their own
 * app account with the invite code the gym gives them; a parent can never
 * attach themselves to a child without it.
 */
@Service
@RequiredArgsConstructor
public class KidsFamilyService {

    static final int INVITE_DAYS = 14;
    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final List<String> LIVE = List.of(Guardianship.ACTIVE, Guardianship.PENDING);

    private final CrmAccessService crmAccessService;
    private final KidsProgramService program;
    private final GuardianshipRepository guardianshipRepository;
    private final AuthorizedPickupRepository pickupRepository;
    private final StudentHealthInfoRepository healthInfoRepository;
    private final StudentDocumentRepository studentDocumentRepository;
    private final GymMemberRepository gymMemberRepository;
    private final GymRepository gymRepository;
    private final UserRepository userRepository;
    private final BeltRankRepository beltRankRepository;

    // ---------- the record ----------

    @Transactional(readOnly = true)
    public FamilyResponse family(Long callerId, Long studentUserId) {
        CrmPrincipal crm = crmAccessService.requireStaff(callerId);
        requireMember(crm.gymId(), studentUserId);
        return familyOf(crm.gymId(), studentUserId);
    }

    /** Registers a child who has no account of their own: the gym manages the profile. */
    @Transactional
    public FamilyResponse createChild(Long callerId, CreateChildRequest request) {
        CrmPrincipal crm = crmAccessService.requireStaff(callerId);
        if (request.birthDate().isAfter(LocalDate.now().minusYears(2))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_BIRTH_DATE", "The child must be at least 2");
        }
        if (request.birthDate().isBefore(LocalDate.now().minusYears(program.adultAge(crm.gymId())))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "NOT_A_CHILD",
                    "This person is an adult for the kids program; they should join with their own account");
        }

        User child = new User();
        child.setFirstName(request.firstName().trim());
        child.setLastName(request.lastName().trim());
        child.setDisplayName((child.getFirstName() + " " + child.getLastName()).trim());
        child.setBirthDate(request.birthDate());
        child.setAge(child.currentAge());
        child.setManaged(true);
        // Children are never listed in people search or shown on public profiles.
        child.setPrivateAccount(true);
        child.setUsername(uniqueChildUsername());
        child = userRepository.save(child);

        GymMember membership = new GymMember();
        membership.setGymId(crm.gymId());
        membership.setUserId(child.getId());
        membership.setRole(GymRole.MEMBER);
        beltRankRepository.findBySlug("kids-white").ifPresent(rank -> membership.setBeltRankId(rank.getId()));
        membership.setStripes(0);
        gymMemberRepository.save(membership);

        if (request.guardian() != null) {
            newGuardian(crm, child.getId(), request.guardian(), true);
        }
        return familyOf(crm.gymId(), child.getId());
    }

    @Transactional
    public FamilyResponse updateBasics(Long callerId, Long studentUserId, UpdateBasicsRequest request) {
        CrmPrincipal crm = crmAccessService.requireStaff(callerId);
        requireMember(crm.gymId(), studentUserId);
        User user = user(studentUserId);
        boolean managed = Boolean.TRUE.equals(user.getManaged());

        if (request.firstName() != null || request.lastName() != null) {
            if (!managed) {
                throw new ApiException(HttpStatus.FORBIDDEN, "NOT_MANAGED",
                        "Only the student can change the name on their own account");
            }
            if (request.firstName() != null) {
                user.setFirstName(request.firstName().trim());
            }
            if (request.lastName() != null) {
                user.setLastName(request.lastName().trim());
            }
            user.setDisplayName((user.getFirstName() + " " + user.getLastName()).trim());
        }
        if (request.birthDate() != null) {
            // The gym may fill in a missing birth date, but not overwrite one a student gave themselves.
            if (!managed && user.getBirthDate() != null && !user.getBirthDate().equals(request.birthDate())) {
                throw new ApiException(HttpStatus.FORBIDDEN, "BIRTH_DATE_SET_BY_STUDENT",
                        "The student already set their birth date");
            }
            user.setBirthDate(request.birthDate());
            user.setAge(user.currentAge());
        }
        userRepository.save(user);
        return familyOf(crm.gymId(), studentUserId);
    }

    // ---------- guardians ----------

    @Transactional
    public FamilyResponse addGuardian(Long callerId, Long studentUserId, GuardianRequest request) {
        CrmPrincipal crm = crmAccessService.requireStaff(callerId);
        requireMember(crm.gymId(), studentUserId);
        long live = guardianshipRepository
                .findAllByGymIdAndStudentUserIdAndStatusInOrderByIdAsc(crm.gymId(), studentUserId, LIVE).size();
        if (live >= 6) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "TOO_MANY_GUARDIANS", "A child can have up to 6 guardians");
        }
        newGuardian(crm, studentUserId, request, live == 0);
        return familyOf(crm.gymId(), studentUserId);
    }

    @Transactional
    public FamilyResponse updateGuardian(Long callerId, Long studentUserId, Long guardianshipId,
            GuardianRequest request) {
        CrmPrincipal crm = crmAccessService.requireStaff(callerId);
        Guardianship g = liveGuardian(crm.gymId(), studentUserId, guardianshipId);
        applyGuardian(g, request);
        if (Boolean.TRUE.equals(g.getPrimaryContact())) {
            clearOtherPrimary(crm.gymId(), studentUserId, g.getId());
        }
        guardianshipRepository.save(g);
        return familyOf(crm.gymId(), studentUserId);
    }

    /** A fresh invite code, e.g. when the first one expired or was lost. */
    @Transactional
    public FamilyResponse renewInvite(Long callerId, Long studentUserId, Long guardianshipId) {
        CrmPrincipal crm = crmAccessService.requireStaff(callerId);
        Guardianship g = liveGuardian(crm.gymId(), studentUserId, guardianshipId);
        if (!Guardianship.PENDING.equals(g.getStatus())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ALREADY_LINKED", "This guardian already linked their account");
        }
        g.setInviteCode(newInviteCode());
        g.setInviteExpiresAt(Instant.now().plus(INVITE_DAYS, ChronoUnit.DAYS));
        guardianshipRepository.save(g);
        return familyOf(crm.gymId(), studentUserId);
    }

    /** Ends a guardian's access. Kept as REVOKED for the record. */
    @Transactional
    public FamilyResponse revokeGuardian(Long callerId, Long studentUserId, Long guardianshipId) {
        CrmPrincipal crm = crmAccessService.requireStaff(callerId);
        Guardianship g = liveGuardian(crm.gymId(), studentUserId, guardianshipId);
        g.setStatus(Guardianship.REVOKED);
        g.setRevokedAt(Instant.now());
        g.setInviteCode(null);
        g.setInviteExpiresAt(null);
        guardianshipRepository.save(g);
        return familyOf(crm.gymId(), studentUserId);
    }

    // ---------- pickup list ----------

    @Transactional
    public FamilyResponse addPickup(Long callerId, Long studentUserId, PickupRequest request) {
        CrmPrincipal crm = crmAccessService.requireStaff(callerId);
        requireMember(crm.gymId(), studentUserId);
        AuthorizedPickup p = new AuthorizedPickup();
        p.setGymId(crm.gymId());
        p.setStudentUserId(studentUserId);
        p.setCreatedByUserId(callerId);
        applyPickup(p, request);
        pickupRepository.save(p);
        return familyOf(crm.gymId(), studentUserId);
    }

    @Transactional
    public FamilyResponse updatePickup(Long callerId, Long studentUserId, Long pickupId, PickupRequest request) {
        CrmPrincipal crm = crmAccessService.requireStaff(callerId);
        AuthorizedPickup p = pickup(crm.gymId(), studentUserId, pickupId);
        applyPickup(p, request);
        pickupRepository.save(p);
        return familyOf(crm.gymId(), studentUserId);
    }

    @Transactional
    public FamilyResponse removePickup(Long callerId, Long studentUserId, Long pickupId) {
        CrmPrincipal crm = crmAccessService.requireStaff(callerId);
        pickupRepository.delete(pickup(crm.gymId(), studentUserId, pickupId));
        return familyOf(crm.gymId(), studentUserId);
    }

    // ---------- emergency card ----------

    @Transactional
    public FamilyResponse saveHealth(Long callerId, Long studentUserId, HealthRequest request) {
        CrmPrincipal crm = crmAccessService.requireStaff(callerId);
        requireMember(crm.gymId(), studentUserId);
        StudentHealthInfo info = healthInfoRepository.findByGymIdAndStudentUserId(crm.gymId(), studentUserId)
                .orElseGet(() -> {
                    StudentHealthInfo created = new StudentHealthInfo();
                    created.setGymId(crm.gymId());
                    created.setStudentUserId(studentUserId);
                    return created;
                });
        info.setBloodType(blankToNull(request.bloodType()));
        info.setAllergies(blankToNull(request.allergies()));
        info.setConditions(blankToNull(request.conditions()));
        info.setMedications(blankToNull(request.medications()));
        info.setHealthPlan(blankToNull(request.healthPlan()));
        info.setEmergencyNotes(blankToNull(request.emergencyNotes()));
        info.setUpdatedByUserId(callerId);
        info.setUpdatedAt(Instant.now());
        healthInfoRepository.save(info);
        return familyOf(crm.gymId(), studentUserId);
    }

    // ---------- documents ----------

    @Transactional
    public FamilyResponse recordDocument(Long callerId, Long studentUserId, RecordDocumentRequest request) {
        CrmPrincipal crm = crmAccessService.requireStaff(callerId);
        requireMember(crm.gymId(), studentUserId);
        DocumentType type = program.documentType(crm.gymId(), request.documentTypeId());
        StudentDocument doc = new StudentDocument();
        doc.setGymId(crm.gymId());
        doc.setStudentUserId(studentUserId);
        doc.setDocumentTypeId(type.getId());
        doc.setSignedByName(request.signedByName().trim());
        doc.setSignedOn(request.signedOn());
        doc.setExpiresOn(type.getRenewalMonths() == null ? null
                : request.signedOn().plusMonths(type.getRenewalMonths()));
        doc.setRecordedByUserId(callerId);
        studentDocumentRepository.save(doc);
        return familyOf(crm.gymId(), studentUserId);
    }

    /** Removes a record entered by mistake. */
    @Transactional
    public FamilyResponse removeDocument(Long callerId, Long studentUserId, Long recordId) {
        CrmPrincipal crm = crmAccessService.requireStaff(callerId);
        StudentDocument doc = studentDocumentRepository
                .findByIdAndGymIdAndStudentUserId(recordId, crm.gymId(), studentUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "DOCUMENT_NOT_FOUND", "Document not found"));
        studentDocumentRepository.delete(doc);
        return familyOf(crm.gymId(), studentUserId);
    }

    // ---------- guardian side (app) ----------

    /** A guardian enters the code the gym gave them, linking their account to the child. */
    @Transactional
    public ChildSummaryDto claim(Long guardianUserId, String code) {
        String normalized = code.trim().toUpperCase(Locale.ROOT).replace("-", "").replace(" ", "");
        Guardianship g = guardianshipRepository.findByInviteCode(normalized)
                .filter(found -> Guardianship.PENDING.equals(found.getStatus()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "INVITE_NOT_FOUND",
                        "Invite code not found. Check it with the gym."));
        if (g.getInviteExpiresAt() != null && g.getInviteExpiresAt().isBefore(Instant.now())) {
            throw new ApiException(HttpStatus.GONE, "INVITE_EXPIRED",
                    "This invite code expired. Ask the gym for a new one.");
        }
        if (g.getStudentUserId().equals(guardianUserId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "SELF_GUARDIAN", "You cannot be your own guardian");
        }
        if (guardianshipRepository.existsByStudentUserIdAndGuardianUserIdAndStatus(g.getStudentUserId(),
                guardianUserId, Guardianship.ACTIVE)) {
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_GUARDIAN", "You are already linked to this child");
        }
        g.setGuardianUserId(guardianUserId);
        g.setStatus(Guardianship.ACTIVE);
        g.setLinkedAt(Instant.now());
        g.setInviteCode(null);
        g.setInviteExpiresAt(null);
        guardianshipRepository.save(g);
        return summary(g);
    }

    @Transactional(readOnly = true)
    public List<ChildSummaryDto> myChildren(Long guardianUserId) {
        return guardianshipRepository.findAllByGuardianUserIdAndStatusOrderByIdAsc(guardianUserId,
                Guardianship.ACTIVE).stream()
                .filter(g -> gymMemberRepository.findByGymIdAndUserId(g.getGymId(), g.getStudentUserId()).isPresent())
                .map(this::summary)
                .toList();
    }

    // ---------- internals ----------

    private FamilyResponse familyOf(Long gymId, Long studentUserId) {
        User user = user(studentUserId);
        boolean configured = program.settingsOf(gymId).isPresent();
        int adultAge = program.adultAge(gymId);
        Integer age = user.currentAge();

        List<Guardianship> guardians = guardianshipRepository
                .findAllByGymIdAndStudentUserIdAndStatusInOrderByIdAsc(gymId, studentUserId, LIVE);
        Map<Long, String> linkedNames = userRepository.findAllById(guardians.stream()
                .map(Guardianship::getGuardianUserId).filter(id -> id != null).toList()).stream()
                .collect(Collectors.toMap(User::getId, User::getDisplayName));
        List<GuardianDto> guardianDtos = guardians.stream()
                .map(g -> new GuardianDto(g.getId(), g.getName(), g.getRelationship(), g.getPhone(), g.getEmail(),
                        Boolean.TRUE.equals(g.getPrimaryContact()), Boolean.TRUE.equals(g.getFinancialResponsible()),
                        g.getStatus(),
                        Guardianship.PENDING.equals(g.getStatus()) ? g.getInviteCode() : null,
                        Guardianship.PENDING.equals(g.getStatus()) ? g.getInviteExpiresAt() : null,
                        g.getLinkedAt(),
                        g.getGuardianUserId() == null ? null : linkedNames.get(g.getGuardianUserId())))
                .toList();

        List<PickupDto> pickups = pickupRepository
                .findAllByGymIdAndStudentUserIdOrderByBlockedDescNameAsc(gymId, studentUserId).stream()
                .map(p -> new PickupDto(p.getId(), p.getName(), p.getRelationship(), p.getPhone(), p.getNotes(),
                        Boolean.TRUE.equals(p.getBlocked())))
                .toList();

        HealthDto health = healthInfoRepository.findByGymIdAndStudentUserId(gymId, studentUserId)
                .map(h -> new HealthDto(h.getBloodType(), h.getAllergies(), h.getConditions(), h.getMedications(),
                        h.getHealthPlan(), h.getEmergencyNotes(), h.getUpdatedAt(),
                        userRepository.findById(h.getUpdatedByUserId()).map(User::getDisplayName).orElse(null)))
                .orElse(null);

        List<StudentDocumentDto> documents = KidsProgramService.documentStatuses(
                program.activeDocumentTypes(gymId),
                studentDocumentRepository.findAllByGymIdAndStudentUserIdOrderBySignedOnDescIdDesc(gymId,
                        studentUserId),
                program.today(gymId));

        return new FamilyResponse(
                user.getId(),
                user.getDisplayName(),
                Boolean.TRUE.equals(user.getManaged()),
                user.getBirthDate(),
                age,
                KidsProgramService.isKid(user, adultAge),
                program.ageGroupName(gymId, age),
                configured,
                guardianDtos,
                pickups,
                health,
                documents,
                KidsProgramService.missingRequired(documents));
    }

    private void newGuardian(CrmPrincipal crm, Long studentUserId, GuardianRequest request, boolean firstOne) {
        Guardianship g = new Guardianship();
        g.setGymId(crm.gymId());
        g.setStudentUserId(studentUserId);
        g.setCreatedByUserId(crm.userId());
        g.setStatus(Guardianship.PENDING);
        g.setInviteCode(newInviteCode());
        g.setInviteExpiresAt(Instant.now().plus(INVITE_DAYS, ChronoUnit.DAYS));
        applyGuardian(g, request);
        // The first guardian is the main contact and the payer unless told otherwise.
        if (firstOne && request.primaryContact() == null) {
            g.setPrimaryContact(true);
        }
        if (firstOne && request.financialResponsible() == null) {
            g.setFinancialResponsible(true);
        }
        g = guardianshipRepository.save(g);
        if (Boolean.TRUE.equals(g.getPrimaryContact())) {
            clearOtherPrimary(crm.gymId(), studentUserId, g.getId());
        }
    }

    private static void applyGuardian(Guardianship g, GuardianRequest request) {
        g.setName(request.name().trim());
        g.setRelationship(request.relationship());
        g.setPhone(blankToNull(request.phone()));
        g.setEmail(request.email() == null || request.email().isBlank() ? null
                : request.email().trim().toLowerCase(Locale.ROOT));
        g.setPrimaryContact(Boolean.TRUE.equals(request.primaryContact()));
        g.setFinancialResponsible(Boolean.TRUE.equals(request.financialResponsible()));
    }

    /** One main contact per child. */
    private void clearOtherPrimary(Long gymId, Long studentUserId, Long keepId) {
        for (Guardianship other : guardianshipRepository
                .findAllByGymIdAndStudentUserIdAndStatusInOrderByIdAsc(gymId, studentUserId, LIVE)) {
            if (!other.getId().equals(keepId) && Boolean.TRUE.equals(other.getPrimaryContact())) {
                other.setPrimaryContact(false);
                guardianshipRepository.save(other);
            }
        }
    }

    private static void applyPickup(AuthorizedPickup p, PickupRequest request) {
        p.setName(request.name().trim());
        p.setRelationship(blankToNull(request.relationship()));
        p.setPhone(blankToNull(request.phone()));
        p.setNotes(blankToNull(request.notes()));
        p.setBlocked(Boolean.TRUE.equals(request.blocked()));
    }

    private ChildSummaryDto summary(Guardianship g) {
        User child = user(g.getStudentUserId());
        String gymName = gymRepository.findById(g.getGymId()).map(Gym::getName).orElse(null);
        return new ChildSummaryDto(child.getId(), child.getDisplayName(), child.currentAge(), gymName,
                g.getRelationship());
    }

    private Guardianship liveGuardian(Long gymId, Long studentUserId, Long guardianshipId) {
        return guardianshipRepository.findByIdAndGymIdAndStudentUserId(guardianshipId, gymId, studentUserId)
                .filter(g -> LIVE.contains(g.getStatus()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "GUARDIAN_NOT_FOUND", "Guardian not found"));
    }

    private AuthorizedPickup pickup(Long gymId, Long studentUserId, Long pickupId) {
        return pickupRepository.findByIdAndGymIdAndStudentUserId(pickupId, gymId, studentUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "PICKUP_NOT_FOUND", "Person not found"));
    }

    private void requireMember(Long gymId, Long studentUserId) {
        gymMemberRepository.findByGymIdAndUserId(gymId, studentUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "Member not found"));
    }

    private User user(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"));
    }

    private String newInviteCode() {
        for (int attempt = 0; attempt < 10; attempt++) {
            StringBuilder code = new StringBuilder(8);
            for (int i = 0; i < 8; i++) {
                code.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
            }
            if (!guardianshipRepository.existsByInviteCode(code.toString())) {
                return code.toString();
            }
        }
        throw new IllegalStateException("Could not generate a unique guardian invite code");
    }

    private String uniqueChildUsername() {
        for (int attempt = 0; attempt < 20; attempt++) {
            String candidate = "kid" + (10_000_000 + RANDOM.nextInt(90_000_000));
            if (!userRepository.existsByUsernameIgnoreCase(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException("Could not generate a unique username for the child");
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
