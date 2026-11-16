package com.bjjflow.backend.kids;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.automations.GymZones;
import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.crm.security.CrmAccessService;
import com.bjjflow.backend.crm.security.CrmPrincipal;
import com.bjjflow.backend.gyms.GymMember;
import com.bjjflow.backend.gyms.GymMemberRepository;
import com.bjjflow.backend.gyms.GymRole;
import com.bjjflow.backend.kids.KidsDtos.AgeGroupDto;
import com.bjjflow.backend.kids.KidsDtos.AgeGroupRequest;
import com.bjjflow.backend.kids.KidsDtos.ChecklistDto;
import com.bjjflow.backend.kids.KidsDtos.DocumentTypeDto;
import com.bjjflow.backend.kids.KidsDtos.DocumentTypeRequest;
import com.bjjflow.backend.kids.KidsDtos.KidFlags;
import com.bjjflow.backend.kids.KidsDtos.SettingsResponse;
import com.bjjflow.backend.kids.KidsDtos.StudentDocumentDto;
import com.bjjflow.backend.kids.KidsDtos.UpdateSettingsRequest;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * The gym's kids program: the owner's settings, and the rules every other
 * screen reads from them (who counts as a kid, which documents are missing).
 */
@Service
@RequiredArgsConstructor
public class KidsProgramService {

    /** Used until the owner sets the program up; matches the KIDS class restriction. */
    public static final int DEFAULT_ADULT_AGE = 16;
    static final int EXPIRING_DAYS = 30;

    private final CrmAccessService crmAccessService;
    private final KidsSettingsRepository settingsRepository;
    private final KidsAgeGroupRepository ageGroupRepository;
    private final DocumentTypeRepository documentTypeRepository;
    private final StudentDocumentRepository studentDocumentRepository;
    private final GuardianshipRepository guardianshipRepository;
    private final StudentHealthInfoRepository healthInfoRepository;
    private final GymMemberRepository gymMemberRepository;
    private final UserRepository userRepository;
    private final GymZones gymZones;

    // ---------- settings ----------

    @Transactional(readOnly = true)
    public SettingsResponse settings(Long callerId) {
        CrmPrincipal crm = crmAccessService.requireStaff(callerId);
        return settingsResponse(crm.gymId());
    }

    /** One click: the recommended rules, age groups and documents. Keeps what the owner already made. */
    @Transactional
    public SettingsResponse applyRecommended(Long callerId) {
        CrmPrincipal crm = crmAccessService.requireOwner(callerId);
        Long gymId = crm.gymId();

        KidsSettings settings = settingsRepository.findById(gymId).orElseGet(() -> {
            KidsSettings created = new KidsSettings();
            created.setGymId(gymId);
            created.setCheckoutRequired(true);
            created.setPickupListOnly(true);
            created.setLatePickupMinutes(15);
            created.setMissingDocumentsPolicy(KidsSettings.POLICY_WARN);
            created.setAdultAge(DEFAULT_ADULT_AGE);
            return created;
        });
        settings.setUpdatedByUserId(callerId);
        settings.setUpdatedAt(Instant.now());
        settingsRepository.save(settings);

        if (ageGroupRepository.findAllByGymIdOrderByPositionAsc(gymId).isEmpty()) {
            saveGroup(gymId, "Pequenos", 4, 6, 0);
            saveGroup(gymId, "Kids", 7, 11, 1);
            saveGroup(gymId, "Juvenil", 12, settings.getAdultAge() - 1, 2);
        }
        if (!documentTypeRepository.existsByGymId(gymId)) {
            saveDocumentType(gymId, "Termo de responsabilidade", "WAIVER", true, 12);
            saveDocumentType(gymId, "Ficha médica", "MEDICAL", true, 12);
            saveDocumentType(gymId, "Autorização de uso de imagem", "IMAGE_CONSENT", false, null);
        }
        return settingsResponse(gymId);
    }

    @Transactional
    public SettingsResponse update(Long callerId, UpdateSettingsRequest request) {
        CrmPrincipal crm = crmAccessService.requireOwner(callerId);
        Long gymId = crm.gymId();
        validateGroups(request.ageGroups(), request.adultAge());

        KidsSettings settings = settingsRepository.findById(gymId).orElseGet(() -> {
            KidsSettings created = new KidsSettings();
            created.setGymId(gymId);
            return created;
        });
        settings.setCheckoutRequired(request.checkoutRequired());
        settings.setPickupListOnly(request.pickupListOnly());
        settings.setLatePickupMinutes(request.latePickupMinutes());
        settings.setMissingDocumentsPolicy(request.missingDocumentsPolicy());
        settings.setAdultAge(request.adultAge());
        settings.setUpdatedByUserId(callerId);
        settings.setUpdatedAt(Instant.now());
        settingsRepository.save(settings);

        ageGroupRepository.deleteAll(ageGroupRepository.findAllByGymIdOrderByPositionAsc(gymId));
        ageGroupRepository.flush();
        List<AgeGroupRequest> groups = request.ageGroups().stream()
                .sorted((a, b) -> Integer.compare(a.minAge(), b.minAge()))
                .toList();
        for (int i = 0; i < groups.size(); i++) {
            AgeGroupRequest g = groups.get(i);
            saveGroup(gymId, g.name().trim(), g.minAge(), g.maxAge(), i);
        }
        return settingsResponse(gymId);
    }

    @Transactional
    public SettingsResponse addDocumentType(Long callerId, DocumentTypeRequest request) {
        CrmPrincipal crm = crmAccessService.requireOwner(callerId);
        saveDocumentType(crm.gymId(), request.name().trim(), request.kind(), request.required(),
                request.renewalMonths());
        return settingsResponse(crm.gymId());
    }

    @Transactional
    public SettingsResponse updateDocumentType(Long callerId, Long typeId, DocumentTypeRequest request) {
        CrmPrincipal crm = crmAccessService.requireOwner(callerId);
        DocumentType type = documentType(crm.gymId(), typeId);
        type.setName(request.name().trim());
        type.setKind(request.kind());
        type.setRequired(request.required());
        type.setRenewalMonths(request.renewalMonths());
        documentTypeRepository.save(type);
        return settingsResponse(crm.gymId());
    }

    /** Retires a document type; records already signed are kept for history. */
    @Transactional
    public SettingsResponse removeDocumentType(Long callerId, Long typeId) {
        CrmPrincipal crm = crmAccessService.requireOwner(callerId);
        DocumentType type = documentType(crm.gymId(), typeId);
        type.setActive(false);
        documentTypeRepository.save(type);
        return settingsResponse(crm.gymId());
    }

    // ---------- rules other services use ----------

    public Optional<KidsSettings> settingsOf(Long gymId) {
        return settingsRepository.findById(gymId);
    }

    public int adultAge(Long gymId) {
        return settingsRepository.findById(gymId).map(KidsSettings::getAdultAge).orElse(DEFAULT_ADULT_AGE);
    }

    public static boolean isKid(User user, int adultAge) {
        Integer age = user.currentAge();
        if (age != null) {
            return age < adultAge;
        }
        return Boolean.TRUE.equals(user.getManaged());
    }

    public String ageGroupName(Long gymId, Integer age) {
        if (age == null) {
            return null;
        }
        return ageGroupRepository.findAllByGymIdOrderByPositionAsc(gymId).stream()
                .filter(g -> g.contains(age))
                .map(KidsAgeGroup::getName)
                .findFirst()
                .orElse(null);
    }

    public DocumentType documentType(Long gymId, Long typeId) {
        return documentTypeRepository.findByIdAndGymId(typeId, gymId)
                .filter(t -> Boolean.TRUE.equals(t.getActive()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "DOCUMENT_TYPE_NOT_FOUND",
                        "Document type not found"));
    }

    public List<DocumentType> activeDocumentTypes(Long gymId) {
        return documentTypeRepository.findAllByGymIdAndActiveTrueOrderByIdAsc(gymId);
    }

    public LocalDate today(Long gymId) {
        return LocalDate.now(gymZones.zoneOf(gymId));
    }

    /** The status of each of the gym's documents for one child, from that child's records (newest first). */
    public static List<StudentDocumentDto> documentStatuses(List<DocumentType> types, List<StudentDocument> records,
            LocalDate today) {
        Map<Long, StudentDocument> latest = new HashMap<>();
        for (StudentDocument record : records) {
            latest.merge(record.getDocumentTypeId(), record,
                    (a, b) -> b.getSignedOn().isAfter(a.getSignedOn()) ? b : a);
        }
        List<StudentDocumentDto> out = new ArrayList<>();
        for (DocumentType type : types) {
            StudentDocument doc = latest.get(type.getId());
            String status;
            if (doc == null) {
                status = "MISSING";
            } else if (doc.getExpiresOn() == null) {
                status = "VALID";
            } else if (doc.getExpiresOn().isBefore(today)) {
                status = "EXPIRED";
            } else if (!doc.getExpiresOn().isAfter(today.plusDays(EXPIRING_DAYS))) {
                status = "EXPIRING";
            } else {
                status = "VALID";
            }
            out.add(new StudentDocumentDto(toDto(type), status,
                    doc == null ? null : doc.getId(),
                    doc == null ? null : doc.getSignedByName(),
                    doc == null ? null : doc.getSignedOn(),
                    doc == null ? null : doc.getExpiresOn()));
        }
        return out;
    }

    /** Required documents a child is missing or has let expire. */
    public static int missingRequired(List<StudentDocumentDto> statuses) {
        return (int) statuses.stream()
                .filter(s -> s.type().required())
                .filter(s -> "MISSING".equals(s.status()) || "EXPIRED".equals(s.status()))
                .count();
    }

    /** Kids flags for every member of the gym, batched to a fixed number of queries. */
    @Transactional(readOnly = true)
    public Map<Long, KidFlags> flagsFor(Long gymId, Collection<GymMember> members) {
        int adultAge = adultAge(gymId);
        Map<Long, User> users = userRepository.findAllById(members.stream().map(GymMember::getUserId).toList())
                .stream().collect(Collectors.toMap(User::getId, u -> u));
        Set<Long> withGuardian = guardianshipRepository
                .findAllByGymIdAndStatusIn(gymId, List.of(Guardianship.ACTIVE, Guardianship.PENDING)).stream()
                .map(Guardianship::getStudentUserId)
                .collect(Collectors.toSet());
        List<DocumentType> types = activeDocumentTypes(gymId);
        Map<Long, List<StudentDocument>> docs = studentDocumentRepository.findAllByGymId(gymId).stream()
                .collect(Collectors.groupingBy(StudentDocument::getStudentUserId));
        LocalDate today = today(gymId);

        Map<Long, KidFlags> out = new HashMap<>();
        for (GymMember member : members) {
            User user = users.get(member.getUserId());
            if (user == null) {
                continue;
            }
            boolean kid = member.getRole() == GymRole.MEMBER && isKid(user, adultAge);
            int missing = kid
                    ? missingRequired(documentStatuses(types, docs.getOrDefault(user.getId(), List.of()), today))
                    : 0;
            out.put(user.getId(), new KidFlags(user.currentAge(), kid, Boolean.TRUE.equals(user.getManaged()),
                    kid && !withGuardian.contains(user.getId()), missing));
        }
        return out;
    }

    // ---------- internals ----------

    private SettingsResponse settingsResponse(Long gymId) {
        Optional<KidsSettings> settings = settingsRepository.findById(gymId);
        List<AgeGroupDto> groups = ageGroupRepository.findAllByGymIdOrderByPositionAsc(gymId).stream()
                .map(g -> new AgeGroupDto(g.getId(), g.getName(), g.getMinAge(), g.getMaxAge()))
                .toList();
        List<DocumentTypeDto> types = activeDocumentTypes(gymId).stream().map(KidsProgramService::toDto).toList();
        return new SettingsResponse(
                settings.isPresent(),
                settings.map(KidsSettings::getCheckoutRequired).orElse(null),
                settings.map(KidsSettings::getPickupListOnly).orElse(null),
                settings.map(KidsSettings::getLatePickupMinutes).orElse(null),
                settings.map(KidsSettings::getMissingDocumentsPolicy).orElse(null),
                settings.map(KidsSettings::getAdultAge).orElse(DEFAULT_ADULT_AGE),
                groups,
                types,
                checklist(gymId));
    }

    private ChecklistDto checklist(Long gymId) {
        List<GymMember> members = gymMemberRepository.findAllByGymId(gymId);
        Map<Long, KidFlags> flags = flagsFor(gymId, members);
        Set<Long> kids = new HashSet<>();
        int withoutGuardian = 0;
        int withMissingDocs = 0;
        for (Map.Entry<Long, KidFlags> entry : flags.entrySet()) {
            if (!entry.getValue().kid()) {
                continue;
            }
            kids.add(entry.getKey());
            if (entry.getValue().noGuardian()) {
                withoutGuardian++;
            }
            if (entry.getValue().missingDocuments() > 0) {
                withMissingDocs++;
            }
        }
        Set<Long> withHealth = healthInfoRepository.findAllByGymId(gymId).stream()
                .map(StudentHealthInfo::getStudentUserId)
                .collect(Collectors.toSet());
        int withoutHealth = (int) kids.stream().filter(id -> !withHealth.contains(id)).count();
        int withoutBirthDate = (int) userRepository.findAllById(kids).stream()
                .filter(u -> u.getBirthDate() == null)
                .count();
        return new ChecklistDto(kids.size(), withoutGuardian, withMissingDocs, withoutHealth, withoutBirthDate);
    }

    private static void validateGroups(List<AgeGroupRequest> groups, int adultAge) {
        List<AgeGroupRequest> sorted = groups.stream()
                .sorted((a, b) -> Integer.compare(a.minAge(), b.minAge()))
                .toList();
        for (int i = 0; i < sorted.size(); i++) {
            AgeGroupRequest g = sorted.get(i);
            if (g.minAge() > g.maxAge()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_AGE_GROUP",
                        "Age group \"" + g.name() + "\" ends before it starts");
            }
            if (g.maxAge() >= adultAge) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_AGE_GROUP",
                        "Age group \"" + g.name() + "\" goes past the adult age");
            }
            if (i > 0 && g.minAge() <= sorted.get(i - 1).maxAge()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "OVERLAPPING_AGE_GROUPS",
                        "Age groups \"" + sorted.get(i - 1).name() + "\" and \"" + g.name() + "\" overlap");
            }
        }
    }

    private void saveGroup(Long gymId, String name, int minAge, int maxAge, int position) {
        KidsAgeGroup group = new KidsAgeGroup();
        group.setGymId(gymId);
        group.setName(name);
        group.setMinAge(minAge);
        group.setMaxAge(maxAge);
        group.setPosition(position);
        ageGroupRepository.save(group);
    }

    private void saveDocumentType(Long gymId, String name, String kind, boolean required, Integer renewalMonths) {
        DocumentType type = new DocumentType();
        type.setGymId(gymId);
        type.setName(name);
        type.setKind(kind);
        type.setRequired(required);
        type.setRenewalMonths(renewalMonths);
        documentTypeRepository.save(type);
    }

    static DocumentTypeDto toDto(DocumentType type) {
        return new DocumentTypeDto(type.getId(), type.getName(), type.getKind(),
                Boolean.TRUE.equals(type.getRequired()), type.getRenewalMonths());
    }
}
