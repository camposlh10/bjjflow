package com.bjjflow.backend.crm.members;

import java.util.List;
import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.auth.AuthDtos.BeltDto;
import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.crm.members.CrmMemberDtos.BeltResponse;
import com.bjjflow.backend.crm.members.CrmMemberDtos.MemberDetailResponse;
import com.bjjflow.backend.crm.members.CrmMemberDtos.MemberResponse;
import com.bjjflow.backend.crm.members.CrmMemberDtos.UpdateMemberRequest;
import com.bjjflow.backend.crm.security.CrmAccessService;
import com.bjjflow.backend.crm.security.CrmPrincipal;
import com.bjjflow.backend.gyms.GymDtos.BeltSummary;
import com.bjjflow.backend.gyms.GymMember;
import com.bjjflow.backend.gyms.GymMemberRepository;
import com.bjjflow.backend.gyms.GymRole;
import com.bjjflow.backend.gyms.GymService;
import com.bjjflow.backend.gyms.StudentAdminDtos.StudentAdminDto;
import com.bjjflow.backend.gyms.StudentAdminService;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CrmMemberService {

    private final CrmAccessService crmAccessService;
    private final GymMemberRepository gymMemberRepository;
    private final UserRepository userRepository;
    private final GymService gymService;
    private final StudentAdminService studentAdminService;

    @Transactional(readOnly = true)
    public List<MemberResponse> members(Long callerId) {
        crmAccessService.requireStaff(callerId);
        return gymService.listMembers(callerId).stream()
                .map(member -> new MemberResponse(member.userId(), member.displayName(), member.role(),
                        belt(member.belt()), member.classesAttended()))
                .toList();
    }

    @Transactional(readOnly = true)
    public MemberDetailResponse member(Long callerId, Long memberUserId) {
        crmAccessService.requireStaff(callerId);
        return memberDetail(callerId, memberUserId);
    }

    @Transactional
    public MemberDetailResponse update(Long callerId, Long memberUserId, UpdateMemberRequest request) {
        CrmPrincipal crm = request.role() == null
                ? crmAccessService.requireStaff(callerId)
                : crmAccessService.requireOwner(callerId);
        GymMember target = gymMemberRepository.findByGymIdAndUserId(crm.gymId(), memberUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "Member not found"));

        if (request.role() != null) {
            if (target.getRole() == GymRole.OWNER) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "OWNER_ROLE_LOCKED",
                        "The gym owner role cannot be changed here");
            }
            target.setRole(GymRole.valueOf(request.role().toUpperCase(Locale.ROOT)));
            gymMemberRepository.save(target);
        }

        if (request.stripes() != null && (request.beltSlug() == null || request.beltSlug().isBlank())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "BELT_REQUIRED", "beltSlug is required with stripes");
        }
        if (request.beltSlug() != null && !request.beltSlug().isBlank()) {
            gymService.promoteMember(callerId, memberUserId, request.beltSlug().trim(), request.stripes());
        }

        return memberDetail(callerId, memberUserId);
    }

    private MemberDetailResponse memberDetail(Long callerId, Long memberUserId) {
        StudentAdminDto student = studentAdminService.student(callerId, memberUserId);
        User user = userRepository.findById(memberUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"));
        return new MemberDetailResponse(
                student.userId(),
                student.username(),
                student.displayName(),
                user.getEmail(),
                student.avatarUrl(),
                student.role(),
                belt(student.belt()),
                student.attendance().totalClasses(),
                student.attendance().last30Days(),
                student.attendance().lastAttended(),
                student.attendance().memberSince());
    }

    private static BeltResponse belt(BeltSummary belt) {
        return belt == null ? null
                : new BeltResponse(belt.slug(), belt.namePt(), belt.namePt(), belt.colorHex(), belt.stripes());
    }

    private static BeltResponse belt(BeltDto belt) {
        return belt == null ? null
                : new BeltResponse(belt.slug(), belt.name(), belt.namePt(), belt.colorHex(), belt.stripes());
    }
}
