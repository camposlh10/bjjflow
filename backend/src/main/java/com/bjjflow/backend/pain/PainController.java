package com.bjjflow.backend.pain;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.pain.PainDtos.LogPainRequest;
import com.bjjflow.backend.pain.PainDtos.PainHistoryDto;
import com.bjjflow.backend.pain.PainDtos.PainMapDto;
import com.bjjflow.backend.pain.PainDtos.PainMonthlyDto;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/users/me/pain")
@RequiredArgsConstructor
public class PainController {

    private final PainService painService;

    private static Long userId(Authentication auth) {
        return Long.parseLong(auth.getName());
    }

    @GetMapping
    public PainMapDto map(Authentication auth) {
        return painService.currentMap(userId(auth));
    }

    @PostMapping
    public PainMapDto log(Authentication auth, @Valid @RequestBody LogPainRequest req) {
        return painService.log(userId(auth), req);
    }

    @GetMapping("/daily")
    public PainMapDto daily(Authentication auth, @RequestParam(required = false) String date) {
        return painService.daily(userId(auth), date);
    }

    @GetMapping("/monthly")
    public PainMonthlyDto monthly(Authentication auth, @RequestParam(required = false) String month) {
        return painService.monthly(userId(auth), month);
    }

    @GetMapping("/history")
    public List<PainHistoryDto> history(Authentication auth, @RequestParam(required = false) Integer limit) {
        return painService.history(userId(auth), limit);
    }
}
