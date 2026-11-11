package com.bjjflow.backend.automations;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.bjjflow.backend.classes.ClassAttendanceRepository;
import com.bjjflow.backend.gyms.Gym;
import com.bjjflow.backend.gyms.GymMember;
import com.bjjflow.backend.gyms.GymMemberRepository;
import com.bjjflow.backend.gyms.GymRole;
import com.bjjflow.backend.notifications.NotificationType;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * Inactivity ladder: 7 days without attendance → friendly nudge to the
 * student; 14 days → follow-up suggestion to the coaches; 30 days →
 * retention alert to the owners. The baseline is the last attended class,
 * or the join date for members who never attended.
 */
@Service
@RequiredArgsConstructor
public class EngagementAutomation {

    private final GymMemberRepository gymMemberRepository;
    private final ClassAttendanceRepository classAttendanceRepository;
    private final UserRepository userRepository;
    private final AutomationEvents automationEvents;

    /** Runs the ladder for one gym; {@code today} is the gym's local date. */
    public int run(Long gymId, LocalDate today, ZoneId zone) {
        Map<Long, LocalDate> lastAttendance = new HashMap<>();
        for (Object[] row : classAttendanceRepository.lastAttendanceDatesForGym(gymId)) {
            lastAttendance.put((Long) row[0], (LocalDate) row[1]);
        }
        List<GymMember> staff = gymMemberRepository.findAllByGymId(gymId).stream()
                .filter(member -> member.getRole() != GymRole.MEMBER)
                .toList();

        int created = 0;
        for (GymMember member : gymMemberRepository.findAllByGymIdAndRole(gymId, GymRole.MEMBER)) {
            LocalDate baseline = lastAttendance.get(member.getUserId());
            if (baseline == null && member.getJoinedAt() != null) {
                baseline = member.getJoinedAt().atZone(zone).toLocalDate();
            }
            if (baseline == null) {
                continue;
            }
            long inactiveDays = ChronoUnit.DAYS.between(baseline, today);
            String refBase = "eng-" + gymId + "-" + member.getUserId() + "-" + baseline;

            if (inactiveDays == 7) {
                if (automationEvents.fireOnce(gymId, AutomationEvents.ENGAGEMENT_NUDGE,
                        refBase + "-7", member.getUserId(), NotificationType.TRAINING,
                        "Sentimos sua falta!",
                        "Faz uma semana que você não aparece no tatame. Bora treinar?")) {
                    created++;
                }
            } else if (inactiveDays == 14) {
                String name = memberName(member.getUserId());
                for (GymMember coach : staff) {
                    if (automationEvents.fireOnce(gymId, AutomationEvents.COACH_FOLLOW_UP,
                            refBase + "-14-" + coach.getUserId(), coach.getUserId(), NotificationType.SYSTEM,
                            "Acompanhamento sugerido",
                            name + " não treina há 14 dias. Que tal mandar uma mensagem?")) {
                        created++;
                    }
                }
            } else if (inactiveDays == 30) {
                String name = memberName(member.getUserId());
                for (GymMember owner : staff) {
                    if (owner.getRole() != GymRole.OWNER) {
                        continue;
                    }
                    if (automationEvents.fireOnce(gymId, AutomationEvents.RETENTION_ALERT,
                            refBase + "-30-" + owner.getUserId(), owner.getUserId(), NotificationType.SYSTEM,
                            "Risco de evasão",
                            name + " não treina há 30 dias. Considere uma ação de retenção.")) {
                        created++;
                    }
                }
            }
        }
        return created;
    }

    private String memberName(Long userId) {
        return userRepository.findById(userId).map(User::getDisplayName).orElse("Um aluno");
    }
}
