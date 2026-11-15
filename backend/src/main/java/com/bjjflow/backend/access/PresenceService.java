package com.bjjflow.backend.access;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.automations.GymZones;
import com.bjjflow.backend.crm.security.CrmAccessService;
import com.bjjflow.backend.crm.security.CrmPrincipal;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * Who is in the gym right now, from today's device passages: a member is
 * inside after an entry until an exit, or until {@link #STAY} has passed with
 * no exit (most devices only see people come in).
 */
@Service
@RequiredArgsConstructor
public class PresenceService {

    static final Duration STAY = Duration.ofHours(3);

    private static final EnumSet<AccessEventStatus> COUNTED = EnumSet.of(
            AccessEventStatus.PROCESSED_ATTENDANCE, AccessEventStatus.PROCESSED_GYM_VISIT,
            AccessEventStatus.UNRESOLVED_CLASS, AccessEventStatus.PROCESSED_EXIT);

    private final CrmAccessService crmAccessService;
    private final RawAccessEventRepository rawAccessEventRepository;
    private final AccessDeviceRepository accessDeviceRepository;
    private final UserRepository userRepository;
    private final GymZones gymZones;

    public record InsideMember(Long userId, String displayName, Instant enteredAt, String deviceName,
            boolean overdue) {
    }

    public record PresenceResponse(int count, List<InsideMember> members, boolean exitsTracked) {
    }

    @Transactional(readOnly = true)
    public PresenceResponse inside(Long callerId, Instant now) {
        CrmPrincipal crm = crmAccessService.requireStaff(callerId);
        ZoneId zone = gymZones.zoneOf(crm.gymId());
        Instant since = LocalDate.ofInstant(now, zone).atStartOfDay(zone).toInstant();
        List<RawAccessEvent> events = rawAccessEventRepository
                .findAllByGymIdAndStudentUserIdIsNotNullAndEventTimeGreaterThanEqualAndStatusInOrderByEventTimeAscIdAsc(
                        crm.gymId(), since, COUNTED);

        // The latest passage of each member decides.
        Map<Long, RawAccessEvent> last = new LinkedHashMap<>();
        boolean exitsTracked = false;
        for (RawAccessEvent event : events) {
            if (event.getEventTime().isAfter(now)) {
                continue;
            }
            exitsTracked |= event.getDirection() == AccessDirection.EXIT;
            last.put(event.getStudentUserId(), event);
        }
        List<RawAccessEvent> inside = last.values().stream()
                .filter(e -> e.getDirection() != AccessDirection.EXIT)
                .filter(e -> e.getEventTime().isAfter(now.minus(STAY)))
                .sorted(Comparator.comparing(RawAccessEvent::getEventTime).reversed())
                .toList();

        Map<Long, User> users = userRepository.findAllById(inside.stream().map(RawAccessEvent::getStudentUserId)
                .toList()).stream().collect(Collectors.toMap(User::getId, Function.identity()));
        Map<Long, AccessDevice> devices = accessDeviceRepository.findAllById(inside.stream()
                .map(RawAccessEvent::getDeviceId).distinct().toList()).stream()
                .collect(Collectors.toMap(AccessDevice::getId, Function.identity()));
        List<InsideMember> members = inside.stream().map(e -> new InsideMember(
                e.getStudentUserId(),
                users.containsKey(e.getStudentUserId()) ? users.get(e.getStudentUserId()).getDisplayName() : null,
                e.getEventTime(),
                devices.containsKey(e.getDeviceId()) ? devices.get(e.getDeviceId()).getName() : null,
                // Any overdue flag today counts: the alert is on the first passage.
                events.stream().anyMatch(x -> x.getStudentUserId().equals(e.getStudentUserId())
                        && Boolean.TRUE.equals(x.getOverdue()))))
                .toList();
        return new PresenceResponse(members.size(), members, exitsTracked);
    }

    @RestController
    @RequestMapping("/api/v1/crm/presence")
    @RequiredArgsConstructor
    static class Controller {

        private final PresenceService presenceService;

        @GetMapping
        PresenceResponse inside(Authentication auth) {
            return presenceService.inside(Long.parseLong(auth.getName()), Instant.now());
        }
    }
}
