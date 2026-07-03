package com.bjjflow.backend.events;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.events.EventDtos.ActivityItemDto;
import com.bjjflow.backend.events.EventDtos.JourneyDto;
import com.bjjflow.backend.events.EventDtos.LogCompetitionRequest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class FeedController {

    private final FeedService feedService;

    private static Long userId(Authentication auth) {
        return Long.parseLong(auth.getName());
    }

    @GetMapping("/gyms/me/activity")
    public List<ActivityItemDto> activity(Authentication auth) {
        return feedService.activity(userId(auth));
    }

    @GetMapping("/users/me/journey")
    public JourneyDto journey(Authentication auth) {
        return feedService.journey(userId(auth));
    }

    @PostMapping("/users/me/competitions")
    public JourneyDto logCompetition(Authentication auth, @Valid @RequestBody LogCompetitionRequest request) {
        return feedService.logCompetition(userId(auth), request);
    }
}
