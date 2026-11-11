package com.bjjflow.backend.home;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.checkins.CheckInDtos.StatsResponse;
import com.bjjflow.backend.checkins.CheckInService;
import com.bjjflow.backend.events.EventDtos.JourneyDto;
import com.bjjflow.backend.events.FeedService;
import com.bjjflow.backend.gyms.GymDtos.GymDto;
import com.bjjflow.backend.gyms.GymService;
import com.bjjflow.backend.notifications.NotificationDtos.NotificationListDto;
import com.bjjflow.backend.notifications.NotificationService;
import com.bjjflow.backend.users.ProfileDtos.UserProfileDto;
import com.bjjflow.backend.users.ProfileService;

import lombok.RequiredArgsConstructor;

/**
 * Everything the app's home screen shows, in one round trip. Each field has
 * exactly the shape of its own endpoint (/users/me/stats, /gyms/me,
 * /users/me/journey, /users/me/notifications, /users/{id}/profile), so the
 * client can drop each part straight into that endpoint's cache.
 */
@RestController
@RequestMapping("/api/v1/home")
@RequiredArgsConstructor
public class HomeController {

    private final HomeService homeService;

    /** {@code gym} is null when the user has not joined one. */
    public record HomeDto(StatsResponse stats, GymDto gym, JourneyDto journey,
            NotificationListDto notifications, UserProfileDto profile) {
    }

    @GetMapping
    public HomeDto home(Authentication auth) {
        return homeService.home(Long.parseLong(auth.getName()));
    }

    @Service
    @RequiredArgsConstructor
    static class HomeService {

        private final CheckInService checkInService;
        private final GymService gymService;
        private final FeedService feedService;
        private final NotificationService notificationService;
        private final ProfileService profileService;

        /** One read-only transaction (one database connection) for the whole screen. */
        @Transactional(readOnly = true)
        public HomeDto home(Long userId) {
            return new HomeDto(
                    checkInService.stats(userId),
                    gymService.getMyGym(userId).orElse(null),
                    feedService.journey(userId),
                    notificationService.list(userId, null),
                    profileService.profile(userId, userId));
        }
    }
}
