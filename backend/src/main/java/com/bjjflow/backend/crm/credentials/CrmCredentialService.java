package com.bjjflow.backend.crm.credentials;

import java.time.Instant;
import java.util.List;
import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.access.CredentialType;
import com.bjjflow.backend.access.MemberCredential;
import com.bjjflow.backend.access.MemberCredentialRepository;
import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.crm.credentials.CrmCredentialDtos.CredentialResponse;
import com.bjjflow.backend.crm.credentials.CrmCredentialDtos.EnrollCredentialRequest;
import com.bjjflow.backend.crm.security.CrmAccessService;
import com.bjjflow.backend.crm.security.CrmPrincipal;
import com.bjjflow.backend.gyms.GymMemberRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CrmCredentialService {

    private final CrmAccessService crmAccessService;
    private final GymMemberRepository gymMemberRepository;
    private final MemberCredentialRepository memberCredentialRepository;

    @Transactional
    public CredentialResponse enroll(Long userId, Long memberUserId, EnrollCredentialRequest request) {
        CrmPrincipal crm = crmAccessService.requireStaff(userId);
        requireMember(crm.gymId(), memberUserId);

        String value = request.value().trim();
        if (memberCredentialRepository.existsByGymIdAndValueIgnoreCaseAndActiveTrue(crm.gymId(), value)) {
            throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_CREDENTIAL",
                    "This credential is already enrolled for a member of this gym");
        }

        MemberCredential credential = new MemberCredential();
        credential.setGymId(crm.gymId());
        credential.setUserId(memberUserId);
        credential.setType(parseType(request.type()));
        credential.setValue(value);
        credential.setLabel(blankToNull(request.label()));
        credential.setActive(true);
        return response(memberCredentialRepository.save(credential));
    }

    @Transactional(readOnly = true)
    public List<CredentialResponse> forMember(Long userId, Long memberUserId) {
        CrmPrincipal crm = crmAccessService.requireStaff(userId);
        requireMember(crm.gymId(), memberUserId);
        return memberCredentialRepository
                .findAllByGymIdAndUserIdOrderByCreatedAtDesc(crm.gymId(), memberUserId).stream()
                .map(this::response)
                .toList();
    }

    @Transactional
    public CredentialResponse revoke(Long userId, Long credentialId) {
        CrmPrincipal crm = crmAccessService.requireStaff(userId);
        MemberCredential credential = memberCredentialRepository.findByIdAndGymId(credentialId, crm.gymId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "CREDENTIAL_NOT_FOUND",
                        "Credential not found"));
        if (Boolean.TRUE.equals(credential.getActive())) {
            credential.setActive(false);
            credential.setRevokedAt(Instant.now());
            memberCredentialRepository.save(credential);
        }
        return response(credential);
    }

    private void requireMember(Long gymId, Long memberUserId) {
        if (gymMemberRepository.findByGymIdAndUserId(gymId, memberUserId).isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "Member not found");
        }
    }

    private CredentialResponse response(MemberCredential credential) {
        return new CredentialResponse(
                credential.getId(), credential.getGymId(), credential.getUserId(),
                credential.getType().name(), credential.getValue(), credential.getLabel(),
                Boolean.TRUE.equals(credential.getActive()), credential.getCreatedAt(), credential.getRevokedAt());
    }

    private static CredentialType parseType(String value) {
        try {
            return CredentialType.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CREDENTIAL_TYPE", "Invalid credential type");
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
