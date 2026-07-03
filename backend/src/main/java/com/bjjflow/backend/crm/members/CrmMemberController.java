package com.bjjflow.backend.crm.members;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.crm.members.CrmMemberDtos.MemberDetailResponse;
import com.bjjflow.backend.crm.members.CrmMemberDtos.MemberResponse;
import com.bjjflow.backend.crm.members.CrmMemberDtos.UpdateMemberRequest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/crm/members")
@RequiredArgsConstructor
public class CrmMemberController {

    private final CrmMemberService crmMemberService;

    @GetMapping
    public List<MemberResponse> members(Authentication auth) {
        return crmMemberService.members(userId(auth));
    }

    @GetMapping("/{userId}")
    public MemberDetailResponse member(Authentication auth, @PathVariable Long userId) {
        return crmMemberService.member(userId(auth), userId);
    }

    @PutMapping("/{userId}")
    public MemberDetailResponse update(Authentication auth, @PathVariable Long userId,
            @Valid @RequestBody UpdateMemberRequest request) {
        return crmMemberService.update(userId(auth), userId, request);
    }

    private static Long userId(Authentication auth) {
        return Long.parseLong(auth.getName());
    }
}
