package com.bjjflow.backend.access;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.access.AccessDtos.AccessEventResponse;
import com.bjjflow.backend.access.AccessDtos.CreateAccessEventRequest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/access/events")
@RequiredArgsConstructor
public class AccessEventController {

    private final AccessEventProcessor accessEventProcessor;

    @PostMapping
    public AccessEventResponse create(Authentication auth, @Valid @RequestBody CreateAccessEventRequest request) {
        return accessEventProcessor.ingest(Long.parseLong(auth.getName()), request);
    }
}
