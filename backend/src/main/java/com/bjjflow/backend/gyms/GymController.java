package com.bjjflow.backend.gyms;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.gyms.GymDtos.CreateGymRequest;
import com.bjjflow.backend.gyms.GymDtos.GymDto;
import com.bjjflow.backend.gyms.GymDtos.GymSuggestionDto;
import com.bjjflow.backend.gyms.GymDtos.JoinGymRequest;
import com.bjjflow.backend.gyms.GymDtos.MemberDto;
import com.bjjflow.backend.gyms.GymDtos.PromoteRequest;
import com.bjjflow.backend.gyms.GymDtos.SetRoleRequest;
import org.springframework.web.bind.annotation.PathVariable;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/gyms")
@RequiredArgsConstructor
public class GymController {

    private final GymService gymService;
    private final com.bjjflow.backend.common.DevTools devTools;

    private static Long userId(Authentication auth) {
        return Long.parseLong(auth.getName());
    }

    @PostMapping
    public GymDto create(Authentication auth, @Valid @RequestBody CreateGymRequest request) {
        return gymService.createGym(userId(auth), request.name(), request.city(), request.description());
    }

    @PostMapping("/join")
    public GymDto join(Authentication auth, @Valid @RequestBody JoinGymRequest request) {
        return gymService.joinByCode(userId(auth), request.inviteCode());
    }

    @PostMapping("/leave")
    public ResponseEntity<Void> leave(Authentication auth) {
        gymService.leaveGym(userId(auth));
        return ResponseEntity.noContent().build();
    }

    // TEMP testing aid — see GymService.setMyRole
    @PostMapping("/me/role")
    public GymDto setRole(Authentication auth, @Valid @RequestBody SetRoleRequest request) {
        devTools.require();
        return gymService.setMyRole(userId(auth), request.role());
    }

    @GetMapping("/me")
    public ResponseEntity<GymDto> myGym(Authentication auth) {
        return gymService.getMyGym(userId(auth))
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/me/members")
    public List<MemberDto> members(Authentication auth) {
        return gymService.listMembers(userId(auth));
    }

    @PostMapping("/me/members/{targetUserId}/promote")
    public MemberDto promote(Authentication auth, @PathVariable Long targetUserId,
            @Valid @RequestBody PromoteRequest request) {
        return gymService.promoteMember(userId(auth), targetUserId, request.beltSlug(), request.stripes());
    }

    @org.springframework.web.bind.annotation.PutMapping("/me")
    public GymDto update(Authentication auth, @Valid @RequestBody GymDtos.UpdateGymRequest request) {
        return gymService.updateGym(userId(auth), request);
    }

    /** Owner-only: update just the gym rules (graduation target, instructors-only posting). */
    @org.springframework.web.bind.annotation.PutMapping("/me/rules")
    public GymDto updateRules(Authentication auth, @Valid @RequestBody GymDtos.UpdateRulesRequest request) {
        return gymService.updateRules(userId(auth), request.graduationTarget(), request.instructorsOnlyPosts());
    }

    // TEMP testing aid — see GymService.toggleVerified
    @PostMapping("/me/verify")
    public GymDto toggleVerified(Authentication auth) {
        devTools.require();
        return gymService.toggleVerified(userId(auth));
    }

    @PostMapping("/me/photos")
    public GymDtos.GymPhotoDto addPhoto(Authentication auth,
            @Valid @RequestBody GymDtos.AddPhotoRequest request) {
        return gymService.addPhoto(userId(auth), request.key());
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/me/photos/{photoId}")
    public void deletePhoto(Authentication auth, @PathVariable Long photoId) {
        gymService.deletePhoto(userId(auth), photoId);
    }

    @GetMapping("/ranking")
    public List<GymDtos.RankingEntryDto> ranking(Authentication auth) {
        return gymService.ranking(userId(auth));
    }

    @GetMapping("/suggestions")
    public List<GymSuggestionDto> suggestions(Authentication auth) {
        return gymService.suggestions(userId(auth));
    }

    @GetMapping("/me/reviews")
    public GymDtos.ReviewsDto reviews(Authentication auth) {
        return gymService.listReviews(userId(auth));
    }

    @PostMapping("/me/reviews")
    public GymDtos.ReviewsDto upsertReview(Authentication auth, @Valid @RequestBody GymDtos.UpsertReviewRequest request) {
        return gymService.upsertReview(userId(auth), request.rating(), request.comment());
    }

    @org.springframework.web.bind.annotation.PutMapping("/me/medals")
    public GymDto updateMedals(Authentication auth, @Valid @RequestBody GymDtos.UpdateMedalsRequest request) {
        return gymService.replaceMedals(userId(auth), request.medals());
    }
}
