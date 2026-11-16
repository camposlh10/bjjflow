package com.bjjflow.backend.kids;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class KidsDtos {

    private KidsDtos() {
    }

    // ---------- program settings (owner) ----------

    public record AgeGroupDto(Long id, String name, int minAge, int maxAge) {
    }

    public record DocumentTypeDto(Long id, String name, String kind, boolean required, Integer renewalMonths) {
    }

    /** What still needs doing across the gym's kids, for the setup checklist. */
    public record ChecklistDto(
            int kids,
            int withoutGuardian,
            int withMissingDocuments,
            int withoutHealthInfo,
            int withoutBirthDate) {
    }

    public record SettingsResponse(
            boolean configured,
            Boolean checkoutRequired,
            Boolean pickupListOnly,
            Integer latePickupMinutes,
            String missingDocumentsPolicy,
            int adultAge,
            List<AgeGroupDto> ageGroups,
            List<DocumentTypeDto> documentTypes,
            ChecklistDto checklist) {
    }

    public record AgeGroupRequest(
            @NotBlank @Size(max = 60) String name,
            @NotNull @Min(2) @Max(17) Integer minAge,
            @NotNull @Min(2) @Max(17) Integer maxAge) {
    }

    public record UpdateSettingsRequest(
            @NotNull Boolean checkoutRequired,
            @NotNull Boolean pickupListOnly,
            @NotNull @Min(5) @Max(240) Integer latePickupMinutes,
            @NotNull @Pattern(regexp = "WARN|BLOCK") String missingDocumentsPolicy,
            @NotNull @Min(12) @Max(18) Integer adultAge,
            @NotNull @Size(max = 10) List<@Valid AgeGroupRequest> ageGroups) {
    }

    public record DocumentTypeRequest(
            @NotBlank @Size(max = 80) String name,
            @NotNull @Pattern(regexp = "WAIVER|MEDICAL|IMAGE_CONSENT|OTHER") String kind,
            @NotNull Boolean required,
            @Min(1) @Max(60) Integer renewalMonths) {
    }

    // ---------- a child's family record (staff) ----------

    public record GuardianRequest(
            @NotBlank @Size(max = 120) String name,
            @NotNull @Pattern(regexp = "MOTHER|FATHER|GRANDPARENT|OTHER") String relationship,
            @Size(max = 30) String phone,
            @Email @Size(max = 255) String email,
            Boolean primaryContact,
            Boolean financialResponsible) {
    }

    public record GuardianDto(
            Long id,
            String name,
            String relationship,
            String phone,
            String email,
            boolean primaryContact,
            boolean financialResponsible,
            String status,
            /** Only while PENDING: the code the guardian enters in the app. */
            String inviteCode,
            Instant inviteExpiresAt,
            Instant linkedAt,
            String linkedAccountName) {
    }

    public record PickupRequest(
            @NotBlank @Size(max = 120) String name,
            @Size(max = 60) String relationship,
            @Size(max = 30) String phone,
            @Size(max = 300) String notes,
            Boolean blocked) {
    }

    public record PickupDto(Long id, String name, String relationship, String phone, String notes, boolean blocked) {
    }

    public record HealthRequest(
            @Size(max = 5) String bloodType,
            @Size(max = 500) String allergies,
            @Size(max = 500) String conditions,
            @Size(max = 500) String medications,
            @Size(max = 120) String healthPlan,
            @Size(max = 500) String emergencyNotes) {
    }

    public record HealthDto(
            String bloodType,
            String allergies,
            String conditions,
            String medications,
            String healthPlan,
            String emergencyNotes,
            Instant updatedAt,
            String updatedByName) {
    }

    public record RecordDocumentRequest(
            @NotNull Long documentTypeId,
            @NotBlank @Size(max = 120) String signedByName,
            @NotNull @PastOrPresent LocalDate signedOn) {
    }

    /** One of the gym's documents for this child: MISSING, VALID, EXPIRING (30 days) or EXPIRED. */
    public record StudentDocumentDto(
            DocumentTypeDto type,
            String status,
            Long recordId,
            String signedByName,
            LocalDate signedOn,
            LocalDate expiresOn) {
    }

    public record FamilyResponse(
            Long userId,
            String displayName,
            boolean managed,
            LocalDate birthDate,
            Integer age,
            boolean kid,
            String ageGroup,
            boolean programConfigured,
            List<GuardianDto> guardians,
            List<PickupDto> pickups,
            HealthDto health,
            List<StudentDocumentDto> documents,
            int missingRequiredDocuments) {
    }

    public record CreateChildRequest(
            @NotBlank @Size(max = 60) String firstName,
            @NotBlank @Size(max = 60) String lastName,
            @NotNull @Past LocalDate birthDate,
            @Valid GuardianRequest guardian) {
    }

    /** Names can be changed only on profiles the gym manages; the birth date when the gym owns it or it is unknown. */
    public record UpdateBasicsRequest(
            @Size(min = 1, max = 60) String firstName,
            @Size(min = 1, max = 60) String lastName,
            @Past LocalDate birthDate) {
    }

    // ---------- members list ----------

    /** Kids-program flags shown next to a member in the CRM list. */
    public record KidFlags(Integer age, boolean kid, boolean managed, boolean noGuardian, int missingDocuments) {
    }

    // ---------- guardian side (app) ----------

    public record ClaimRequest(@NotBlank @Size(max = 12) String code) {
    }

    public record ChildSummaryDto(
            Long studentUserId,
            String displayName,
            Integer age,
            String gymName,
            String relationship) {
    }
}
