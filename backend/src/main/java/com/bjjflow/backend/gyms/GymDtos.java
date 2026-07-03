package com.bjjflow.backend.gyms;

import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class GymDtos {

    public record CreateGymRequest(
            @NotBlank @Size(max = 150) String name,
            @Size(max = 100) String city,
            @Size(max = 500) String description) {
    }

    public record JoinGymRequest(@NotBlank @Size(max = 12) String inviteCode) {
    }

    public record SetRoleRequest(@NotBlank String role) {
    }

    public record BeltSummary(String slug, String namePt, String colorHex, int stripes) {
    }

    public record GymPhotoDto(Long id, String url) {
    }

    public record GymDto(
            Long id,
            String name,
            String city,
            String description,
            long memberCount,
            String role,
            Integer graduationTarget,
            boolean instructorsOnlyPosts,
            /** only present for owner/instructor, so staff can share it */
            String inviteCode,
            String phone,
            String email,
            String website,
            String address,
            String logoUrl,
            List<GymPhotoDto> photos,
            boolean verified,
            String instagram,
            String facebook,
            String whatsapp,
            String youtube,
            String googlePlaceId,
            List<MedalDto> medals,
            java.time.Instant createdAt,
            /** present when approved (public) or for the owner to see pending status; null otherwise */
            VerificationDto verification) {
    }

    public record UpdateGymRequest(
            @NotBlank @Size(max = 150) String name,
            @Size(max = 100) String city,
            @Size(max = 500) String description,
            @jakarta.validation.constraints.Min(1) @jakarta.validation.constraints.Max(500) Integer graduationTarget,
            Boolean instructorsOnlyPosts,
            @Size(max = 30) String phone,
            @Size(max = 255) String email,
            @Size(max = 255) String website,
            @Size(max = 255) String address,
            @Size(max = 300) String logoKey,
            @Size(max = 255) String instagram,
            @Size(max = 255) String facebook,
            @Size(max = 50) String whatsapp,
            @Size(max = 255) String youtube,
            @Size(max = 150) String googlePlaceId) {
    }

    public record AddPhotoRequest(@NotBlank String key) {
    }

    public record UpdateRulesRequest(
            @jakarta.validation.constraints.Min(1) @jakarta.validation.constraints.Max(500) Integer graduationTarget,
            Boolean instructorsOnlyPosts) {
    }

    public record RankingEntryDto(int position, Long userId, String displayName,
            BeltSummary belt, long classes) {
    }

    public record MemberDto(Long userId, String displayName, String role, BeltSummary belt,
            /** verified class attendances since the last promotion (graduation counter) */
            long classesAttended) {
    }

    public record PromoteRequest(
            @NotBlank String beltSlug,
            @jakarta.validation.constraints.Min(0) @jakarta.validation.constraints.Max(6) Integer stripes) {
    }

    public record GymSuggestionDto(Long id, String name, String city, long memberCount) {
    }

    public record MembersResponse(List<MemberDto> members) {
    }

    public record ReviewDto(Long id, Long userId, String displayName, int rating, String comment, java.time.Instant createdAt) {
    }

    public record ReviewSummaryDto(double average, long count, Integer myRating, String myComment) {
    }

    public record ReviewsDto(ReviewSummaryDto summary, List<ReviewDto> reviews) {
    }

    public record UpsertReviewRequest(
            @jakarta.validation.constraints.Min(1) @jakarta.validation.constraints.Max(5) int rating,
            @Size(max = 1000) String comment) {
    }

    public record MedalDto(Long id, String competition, String tier, int count) {
    }

    public record MedalInput(
            @NotBlank @Size(max = 100) String competition,
            @NotBlank @Size(max = 20) String tier,
            @jakarta.validation.constraints.Min(1) @jakarta.validation.constraints.Max(9999) int count) {
    }

    public record UpdateMedalsRequest(
            @jakarta.validation.constraints.Size(max = 50) @jakarta.validation.Valid List<MedalInput> medals) {
    }

    public record VerificationDto(
            String status,
            String cnpj,
            String certificateUrl,
            List<String> establishmentUrls,
            String reviewNotes) {
    }

    public record SubmitVerificationRequest(
            @NotBlank @Size(max = 20) String cnpj,
            @NotBlank @Size(max = 300) String certificateKey,
            @jakarta.validation.constraints.NotEmpty @Size(max = 10) List<@NotBlank @Size(max = 300) String> establishmentKeys) {
    }

    public record AdminDecisionRequest(boolean approve, @Size(max = 1000) String notes) {
    }

    public record VerificationAdminDto(
            Long id,
            Long gymId,
            String gymName,
            String status,
            String cnpj,
            String certificateUrl,
            List<String> establishmentUrls,
            Double aiConfidence,
            String aiSummary,
            String reviewNotes,
            java.time.Instant createdAt) {
    }
}
