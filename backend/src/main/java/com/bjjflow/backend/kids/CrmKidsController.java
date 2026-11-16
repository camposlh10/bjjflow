package com.bjjflow.backend.kids;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.kids.KidsDtos.CreateChildRequest;
import com.bjjflow.backend.kids.KidsDtos.DocumentTypeRequest;
import com.bjjflow.backend.kids.KidsDtos.FamilyResponse;
import com.bjjflow.backend.kids.KidsDtos.GuardianRequest;
import com.bjjflow.backend.kids.KidsDtos.HealthRequest;
import com.bjjflow.backend.kids.KidsDtos.PickupRequest;
import com.bjjflow.backend.kids.KidsDtos.RecordDocumentRequest;
import com.bjjflow.backend.kids.KidsDtos.SettingsResponse;
import com.bjjflow.backend.kids.KidsDtos.UpdateBasicsRequest;
import com.bjjflow.backend.kids.KidsDtos.UpdateSettingsRequest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * Kids program in the CRM. Settings are changed by the owner; every staff
 * member keeps the children's family records.
 */
@RestController
@RequestMapping("/api/v1/crm/kids")
@RequiredArgsConstructor
public class CrmKidsController {

    private final KidsProgramService program;
    private final KidsFamilyService family;

    // ---------- settings ----------

    @GetMapping("/settings")
    public SettingsResponse settings(Authentication auth) {
        return program.settings(userId(auth));
    }

    @PostMapping("/settings/recommended")
    public SettingsResponse applyRecommended(Authentication auth) {
        return program.applyRecommended(userId(auth));
    }

    @PutMapping("/settings")
    public SettingsResponse update(Authentication auth, @Valid @RequestBody UpdateSettingsRequest request) {
        return program.update(userId(auth), request);
    }

    @PostMapping("/document-types")
    public SettingsResponse addDocumentType(Authentication auth, @Valid @RequestBody DocumentTypeRequest request) {
        return program.addDocumentType(userId(auth), request);
    }

    @PutMapping("/document-types/{typeId}")
    public SettingsResponse updateDocumentType(Authentication auth, @PathVariable Long typeId,
            @Valid @RequestBody DocumentTypeRequest request) {
        return program.updateDocumentType(userId(auth), typeId, request);
    }

    @DeleteMapping("/document-types/{typeId}")
    public SettingsResponse removeDocumentType(Authentication auth, @PathVariable Long typeId) {
        return program.removeDocumentType(userId(auth), typeId);
    }

    // ---------- children ----------

    @PostMapping("/children")
    public FamilyResponse createChild(Authentication auth, @Valid @RequestBody CreateChildRequest request) {
        return family.createChild(userId(auth), request);
    }

    @GetMapping("/students/{studentId}")
    public FamilyResponse family(Authentication auth, @PathVariable Long studentId) {
        return family.family(userId(auth), studentId);
    }

    @PutMapping("/students/{studentId}/basics")
    public FamilyResponse updateBasics(Authentication auth, @PathVariable Long studentId,
            @Valid @RequestBody UpdateBasicsRequest request) {
        return family.updateBasics(userId(auth), studentId, request);
    }

    @PostMapping("/students/{studentId}/guardians")
    public FamilyResponse addGuardian(Authentication auth, @PathVariable Long studentId,
            @Valid @RequestBody GuardianRequest request) {
        return family.addGuardian(userId(auth), studentId, request);
    }

    @PutMapping("/students/{studentId}/guardians/{guardianId}")
    public FamilyResponse updateGuardian(Authentication auth, @PathVariable Long studentId,
            @PathVariable Long guardianId, @Valid @RequestBody GuardianRequest request) {
        return family.updateGuardian(userId(auth), studentId, guardianId, request);
    }

    @PostMapping("/students/{studentId}/guardians/{guardianId}/invite")
    public FamilyResponse renewInvite(Authentication auth, @PathVariable Long studentId,
            @PathVariable Long guardianId) {
        return family.renewInvite(userId(auth), studentId, guardianId);
    }

    @DeleteMapping("/students/{studentId}/guardians/{guardianId}")
    public FamilyResponse revokeGuardian(Authentication auth, @PathVariable Long studentId,
            @PathVariable Long guardianId) {
        return family.revokeGuardian(userId(auth), studentId, guardianId);
    }

    @PostMapping("/students/{studentId}/pickups")
    public FamilyResponse addPickup(Authentication auth, @PathVariable Long studentId,
            @Valid @RequestBody PickupRequest request) {
        return family.addPickup(userId(auth), studentId, request);
    }

    @PutMapping("/students/{studentId}/pickups/{pickupId}")
    public FamilyResponse updatePickup(Authentication auth, @PathVariable Long studentId,
            @PathVariable Long pickupId, @Valid @RequestBody PickupRequest request) {
        return family.updatePickup(userId(auth), studentId, pickupId, request);
    }

    @DeleteMapping("/students/{studentId}/pickups/{pickupId}")
    public FamilyResponse removePickup(Authentication auth, @PathVariable Long studentId,
            @PathVariable Long pickupId) {
        return family.removePickup(userId(auth), studentId, pickupId);
    }

    @PutMapping("/students/{studentId}/health")
    public FamilyResponse saveHealth(Authentication auth, @PathVariable Long studentId,
            @Valid @RequestBody HealthRequest request) {
        return family.saveHealth(userId(auth), studentId, request);
    }

    @PostMapping("/students/{studentId}/documents")
    public FamilyResponse recordDocument(Authentication auth, @PathVariable Long studentId,
            @Valid @RequestBody RecordDocumentRequest request) {
        return family.recordDocument(userId(auth), studentId, request);
    }

    @DeleteMapping("/students/{studentId}/documents/{recordId}")
    public FamilyResponse removeDocument(Authentication auth, @PathVariable Long studentId,
            @PathVariable Long recordId) {
        return family.removeDocument(userId(auth), studentId, recordId);
    }

    private static Long userId(Authentication auth) {
        return Long.parseLong(auth.getName());
    }
}
