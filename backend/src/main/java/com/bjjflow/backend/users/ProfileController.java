package com.bjjflow.backend.users;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

import org.springframework.web.bind.annotation.RequestParam;

import com.bjjflow.backend.events.EventDtos.JourneyDto;
import com.bjjflow.backend.events.FeedService;
import com.bjjflow.backend.gyms.GymDtos.AddPhotoRequest;
import com.bjjflow.backend.gyms.GymDtos.UpdateMedalsRequest;
import com.bjjflow.backend.users.ProfileDtos.ChangeEmailRequest;
import com.bjjflow.backend.users.ProfileDtos.ChangePasswordRequest;
import com.bjjflow.backend.users.ProfileDtos.CompleteProfileRequest;
import com.bjjflow.backend.users.ProfileDtos.FeedbackRequest;
import com.bjjflow.backend.users.ProfileDtos.SearchUserDto;
import com.bjjflow.backend.users.ProfileDtos.SettingsDto;
import com.bjjflow.backend.users.ProfileDtos.UpdateProfileRequest;
import com.bjjflow.backend.users.ProfileDtos.UpdateSettingsRequest;
import com.bjjflow.backend.users.ProfileDtos.UserProfileDto;

import org.springframework.http.ResponseEntity;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class ProfileController {

    private final ProfileService profileService;
    private final FeedService feedService;
    private final com.bjjflow.backend.common.DevTools devTools;

    private static Long userId(Authentication auth) {
        return Long.parseLong(auth.getName());
    }

    @GetMapping("/search")
    public List<SearchUserDto> search(@RequestParam(name = "q", defaultValue = "") String q) {
        return profileService.search(q);
    }

    @GetMapping("/{id}/profile")
    public UserProfileDto profile(Authentication auth, @PathVariable Long id) {
        return profileService.profile(userId(auth), id);
    }

    @GetMapping("/{id}/journey")
    public JourneyDto journey(@PathVariable Long id) {
        return feedService.journey(id);
    }

    @PutMapping("/me/profile")
    public UserProfileDto updateProfile(Authentication auth, @Valid @RequestBody UpdateProfileRequest request) {
        return profileService.updateProfile(userId(auth), request);
    }

    @PutMapping("/me/medals")
    public UserProfileDto updateMedals(Authentication auth, @Valid @RequestBody UpdateMedalsRequest request) {
        return profileService.replaceMedals(userId(auth), request.medals());
    }

    /** Fill in / edit profile basics (belt, age, location, etc.) after signup. */
    @PutMapping("/me/onboarding")
    public UserProfileDto completeProfile(Authentication auth, @Valid @RequestBody CompleteProfileRequest request) {
        return profileService.completeProfile(userId(auth), request);
    }

    @PostMapping("/me/photos")
    public UserProfileDto addPhoto(Authentication auth, @Valid @RequestBody AddPhotoRequest request) {
        return profileService.addPhoto(userId(auth), request.key());
    }

    @DeleteMapping("/me/photos/{photoId}")
    public UserProfileDto deletePhoto(Authentication auth, @PathVariable Long photoId) {
        return profileService.deletePhoto(userId(auth), photoId);
    }

    // TEMP testing aid — preview the PRO badge before subscriptions exist.
    @PostMapping("/me/pro")
    public UserProfileDto togglePro(Authentication auth) {
        devTools.require();
        return profileService.togglePro(userId(auth));
    }

    @GetMapping("/me/settings")
    public SettingsDto settings(Authentication auth) {
        return profileService.settings(userId(auth));
    }

    @PutMapping("/me/settings")
    public SettingsDto updateSettings(Authentication auth, @Valid @RequestBody UpdateSettingsRequest request) {
        return profileService.updateSettings(userId(auth), request);
    }

    @PutMapping("/me/password")
    public ResponseEntity<Void> changePassword(Authentication auth, @Valid @RequestBody ChangePasswordRequest request) {
        profileService.changePassword(userId(auth), request.currentPassword(), request.newPassword());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/me/email")
    public SettingsDto changeEmail(Authentication auth, @Valid @RequestBody ChangeEmailRequest request) {
        return profileService.changeEmail(userId(auth), request.password(), request.email());
    }

    @PostMapping("/me/feedback")
    public ResponseEntity<Void> feedback(Authentication auth, @Valid @RequestBody FeedbackRequest request) {
        profileService.submitFeedback(userId(auth), request.message());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/follow")
    public UserProfileDto follow(Authentication auth, @PathVariable Long id) {
        return profileService.follow(userId(auth), id);
    }

    @DeleteMapping("/{id}/follow")
    public UserProfileDto unfollow(Authentication auth, @PathVariable Long id) {
        return profileService.unfollow(userId(auth), id);
    }
}
