package com.bjjflow.backend.crm.security;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.gyms.GymMember;
import com.bjjflow.backend.gyms.GymMemberRepository;
import com.bjjflow.backend.gyms.GymRole;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CrmAccessService {

    private final GymMemberRepository gymMemberRepository;

    public CrmPrincipal requireStaff(Long userId) {
        GymMember member = gymMemberRepository.findFirstByUserId(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NO_GYM", "You are not in a gym"));

        if (member.getRole() == GymRole.MEMBER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "CRM_STAFF_ONLY",
                    "Only gym staff can access the CRM");
        }

        return new CrmPrincipal(userId, member.getGymId(), member.getRole());
    }

    public CrmPrincipal requireOwner(Long userId) {
        CrmPrincipal principal = requireStaff(userId);
        if (!principal.isOwner()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "CRM_OWNER_ONLY",
                    "Only gym owners can perform this action");
        }
        return principal;
    }
}
