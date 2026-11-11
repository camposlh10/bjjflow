package com.bjjflow.backend.crm.notifications;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.automations.AutomationEvents;
import com.bjjflow.backend.automations.AutomationRunner;
import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.crm.notifications.CrmNotificationDtos.AnnouncementRequest;
import com.bjjflow.backend.crm.notifications.CrmNotificationDtos.AnnouncementResponse;
import com.bjjflow.backend.crm.notifications.CrmNotificationDtos.AutomationEventResponse;
import com.bjjflow.backend.crm.notifications.CrmNotificationDtos.RunAutomationsResponse;
import com.bjjflow.backend.crm.security.CrmAccessService;
import com.bjjflow.backend.crm.security.CrmPrincipal;
import com.bjjflow.backend.gyms.GymMember;
import com.bjjflow.backend.gyms.GymMemberRepository;
import com.bjjflow.backend.notifications.AutomationEvent;
import com.bjjflow.backend.notifications.AutomationEventRepository;
import com.bjjflow.backend.notifications.NotificationService;
import com.bjjflow.backend.notifications.NotificationType;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CrmNotificationService {

    private static final int LOG_SIZE = 100;

    private final CrmAccessService crmAccessService;
    private final GymMemberRepository gymMemberRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final AutomationEvents automationEvents;
    private final AutomationEventRepository automationEventRepository;
    private final AutomationRunner automationRunner;

    @Transactional
    public AnnouncementResponse sendAnnouncement(Long userId, AnnouncementRequest request) {
        CrmPrincipal crm = crmAccessService.requireStaff(userId);

        List<Long> recipients;
        if (request.memberUserId() != null) {
            gymMemberRepository.findByGymIdAndUserId(crm.gymId(), request.memberUserId())
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND",
                            "Member not found"));
            recipients = List.of(request.memberUserId());
        } else {
            recipients = gymMemberRepository.findAllByGymId(crm.gymId()).stream()
                    .map(GymMember::getUserId)
                    .filter(memberId -> !memberId.equals(userId))
                    .toList();
        }

        String title = request.title().trim();
        String message = request.message().trim();
        notificationService.notifyMany(recipients, NotificationType.ACADEMY, title, message, null);
        automationEvents.fireOnce(crm.gymId(), AutomationEvents.ANNOUNCEMENT,
                "announcement-" + UUID.randomUUID(), request.memberUserId(), null, title, message);
        return new AnnouncementResponse(recipients.size());
    }

    @Transactional(readOnly = true)
    public List<AutomationEventResponse> events(Long userId) {
        CrmPrincipal crm = crmAccessService.requireStaff(userId);
        List<AutomationEvent> events = automationEventRepository
                .findAllByGymIdOrderByCreatedAtDescIdDesc(crm.gymId(), PageRequest.of(0, LOG_SIZE));

        Set<Long> memberIds = events.stream()
                .map(AutomationEvent::getUserId)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, String> names = memberIds.isEmpty() ? Map.of()
                : userRepository.findAllById(memberIds).stream()
                        .collect(Collectors.toMap(User::getId, User::getDisplayName, (a, b) -> a));

        return events.stream()
                .map(event -> new AutomationEventResponse(
                        event.getId(), event.getType(), event.getUserId(),
                        event.getUserId() == null ? null : names.get(event.getUserId()),
                        event.getTitle(), event.getBody(), event.getCreatedAt()))
                .toList();
    }

    public RunAutomationsResponse runNow(Long userId) {
        CrmPrincipal crm = crmAccessService.requireOwner(userId);
        // Only this owner's gym, at the gym's local date.
        return new RunAutomationsResponse(automationRunner.runForGym(crm.gymId()));
    }
}
