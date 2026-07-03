package com.bjjflow.backend.crm.settings;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.crm.security.CrmAccessService;
import com.bjjflow.backend.gyms.GymDtos.GymDto;
import com.bjjflow.backend.gyms.GymDtos.UpdateGymRequest;
import com.bjjflow.backend.gyms.GymService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * Gym settings for the CRM dashboard. Delegates to the shared GymService, so
 * edits made here are the same gym record the mobile app reads and vice versa.
 */
@RestController
@RequestMapping("/api/v1/crm/gym")
@RequiredArgsConstructor
public class CrmGymSettingsController {

    private final CrmAccessService crmAccessService;
    private final GymService gymService;

    @GetMapping
    public GymDto gym(Authentication auth) {
        Long userId = userId(auth);
        crmAccessService.requireStaff(userId);
        return gymService.getMyGym(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NO_GYM", "You are not in a gym"));
    }

    @PutMapping
    public GymDto update(Authentication auth, @Valid @RequestBody UpdateGymRequest request) {
        Long userId = userId(auth);
        crmAccessService.requireStaff(userId);
        // GymService.updateGym enforces the owner-only rule itself.
        return gymService.updateGym(userId, request);
    }

    private static Long userId(Authentication auth) {
        return Long.parseLong(auth.getName());
    }
}
