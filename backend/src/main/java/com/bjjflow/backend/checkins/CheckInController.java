package com.bjjflow.backend.checkins;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.checkins.CheckInDtos.CheckInDto;
import com.bjjflow.backend.checkins.CheckInDtos.CreateCheckInRequest;
import com.bjjflow.backend.checkins.CheckInDtos.StatsResponse;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
public class CheckInController {

    private final CheckInService checkInService;

    @PostMapping("/api/v1/checkins")
    public CheckInDto create(Authentication auth, @Valid @RequestBody CreateCheckInRequest request) {
        return checkInService.create(Long.parseLong(auth.getName()), request);
    }

    @GetMapping("/api/v1/checkins")
    public List<CheckInDto> list(Authentication auth,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return checkInService.list(Long.parseLong(auth.getName()), from, to);
    }

    @GetMapping("/api/v1/users/me/stats")
    public StatsResponse stats(Authentication auth) {
        return checkInService.stats(Long.parseLong(auth.getName()));
    }
}
