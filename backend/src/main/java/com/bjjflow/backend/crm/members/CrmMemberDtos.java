package com.bjjflow.backend.crm.members;

import java.time.Instant;
import java.time.LocalDate;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class CrmMemberDtos {

    private CrmMemberDtos() {
    }

    public record BeltResponse(
            String slug,
            String name,
            String namePt,
            String colorHex,
            int stripes) {
    }

    public record MemberResponse(
            Long userId,
            String displayName,
            String role,
            BeltResponse belt,
            long classesAttended) {
    }

    public record MemberDetailResponse(
            Long userId,
            String username,
            String displayName,
            String email,
            String avatarUrl,
            String role,
            BeltResponse belt,
            long totalClasses,
            long last30Days,
            LocalDate lastAttended,
            Instant memberSince) {
    }

    public record UpdateMemberRequest(
            @Pattern(regexp = "(?i)MEMBER|INSTRUCTOR", message = "role must be MEMBER or INSTRUCTOR") String role,
            @Size(max = 50) String beltSlug,
            @Min(0) @Max(6) Integer stripes) {
    }
}
