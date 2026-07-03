package com.bjjflow.backend.notifications;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.notifications.NotificationDtos.NotificationListDto;
import com.bjjflow.backend.notifications.NotificationDtos.RegisterTokenRequest;
import com.bjjflow.backend.notifications.NotificationDtos.RemoveTokenRequest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/users/me")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final InsightService insightService;

    private static Long userId(Authentication auth) {
        return Long.parseLong(auth.getName());
    }

    @GetMapping("/notifications")
    public NotificationListDto list(Authentication auth, @RequestParam(required = false) Integer limit) {
        return notificationService.list(userId(auth), limit);
    }

    /** Recompute data-driven insights, then return the (refreshed) notification list. */
    @PostMapping("/insights/refresh")
    public NotificationListDto refreshInsights(Authentication auth, @RequestParam(required = false) Integer limit) {
        Long uid = userId(auth);
        insightService.refresh(uid);
        return notificationService.list(uid, limit);
    }

    @PostMapping("/notifications/{id}/read")
    public ResponseEntity<Void> markRead(Authentication auth, @PathVariable Long id) {
        notificationService.markRead(userId(auth), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/notifications/read-all")
    public ResponseEntity<Void> markAllRead(Authentication auth) {
        notificationService.markAllRead(userId(auth));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/push-tokens")
    public ResponseEntity<Void> registerToken(Authentication auth, @Valid @RequestBody RegisterTokenRequest req) {
        notificationService.registerToken(userId(auth), req.token(), req.platform());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/push-tokens/remove")
    public ResponseEntity<Void> removeToken(Authentication auth, @Valid @RequestBody RemoveTokenRequest req) {
        notificationService.removeToken(req.token());
        return ResponseEntity.noContent().build();
    }
}
