package com.bjjflow.backend.crm.notifications;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.crm.notifications.CrmNotificationDtos.AnnouncementRequest;
import com.bjjflow.backend.crm.notifications.CrmNotificationDtos.AnnouncementResponse;
import com.bjjflow.backend.crm.notifications.CrmNotificationDtos.AutomationEventResponse;
import com.bjjflow.backend.crm.notifications.CrmNotificationDtos.RunAutomationsResponse;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/crm/notifications")
@RequiredArgsConstructor
public class CrmNotificationController {

    private final CrmNotificationService crmNotificationService;

    @PostMapping("/announcements")
    public AnnouncementResponse sendAnnouncement(Authentication auth,
            @Valid @RequestBody AnnouncementRequest request) {
        return crmNotificationService.sendAnnouncement(userId(auth), request);
    }

    @GetMapping("/events")
    public List<AutomationEventResponse> events(Authentication auth) {
        return crmNotificationService.events(userId(auth));
    }

    @PostMapping("/run-automations")
    public RunAutomationsResponse runNow(Authentication auth) {
        return crmNotificationService.runNow(userId(auth));
    }

    private static Long userId(Authentication auth) {
        return Long.parseLong(auth.getName());
    }
}
