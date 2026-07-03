package com.bjjflow.backend.dev;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.common.DevTools;
import com.bjjflow.backend.dev.DevBotService.BotDto;

import lombok.RequiredArgsConstructor;

/** TEMP dev/testing endpoints — disabled in production via {@link DevTools}. */
@RestController
@RequestMapping("/api/v1/dev")
@RequiredArgsConstructor
public class DevController {

    private final DevBotService devBotService;
    private final DevTools devTools;

    /** Adds the BJJ Bot as a student in the caller's gym + seeds feed/attendance data. */
    @PostMapping("/bot")
    public BotDto addBot(Authentication auth) {
        devTools.require();
        return devBotService.spawnInMyGym(Long.parseLong(auth.getName()));
    }
}
