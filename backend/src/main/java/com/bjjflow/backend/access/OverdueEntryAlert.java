package com.bjjflow.backend.access;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.EnumSet;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.bjjflow.backend.gyms.GymMember;
import com.bjjflow.backend.gyms.GymMemberRepository;
import com.bjjflow.backend.gyms.GymRole;
import com.bjjflow.backend.notifications.NotificationService;
import com.bjjflow.backend.notifications.NotificationType;
import com.bjjflow.backend.payments.Invoice;
import com.bjjflow.backend.payments.InvoiceRepository;
import com.bjjflow.backend.payments.PaymentStatus;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * When a member with an overdue invoice comes in, flags the passage and tells
 * the gym's staff (once per member per day) so the front desk can talk to
 * them. The door is not blocked: blocking on the device itself is not built
 * (on Control iD an expiry date can make the device delete the member's face).
 */
@Service
@RequiredArgsConstructor
public class OverdueEntryAlert {

    private static final Logger log = LoggerFactory.getLogger(OverdueEntryAlert.class);
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd/MM");
    private static final DateTimeFormatter HM = DateTimeFormatter.ofPattern("HH:mm");

    private final InvoiceRepository invoiceRepository;
    private final RawAccessEventRepository rawAccessEventRepository;
    private final GymMemberRepository gymMemberRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    /** Call for an entry whose member is known, inside the event's processing transaction. */
    void check(RawAccessEvent event, Long studentUserId, ZoneId zone) {
        LocalDate today = event.getEventTime().atZone(zone).toLocalDate();
        Invoice oldest = invoiceRepository.findFirstByGymIdAndMemberUserIdAndStatusInAndDueDateBeforeOrderByDueDateAsc(
                event.getGymId(), studentUserId, EnumSet.of(PaymentStatus.PENDING, PaymentStatus.OVERDUE), today)
                .orElse(null);
        if (oldest == null) {
            return;
        }
        event.setOverdue(true);
        boolean alertedToday = rawAccessEventRepository
                .existsByGymIdAndStudentUserIdAndOverdueTrueAndEventTimeGreaterThanEqualAndIdNot(event.getGymId(),
                        studentUserId, today.atStartOfDay(zone).toInstant(), event.getId());
        if (alertedToday) {
            return;
        }
        String name = userRepository.findById(studentUserId).map(u -> u.getDisplayName()).orElse("Aluno");
        String title = name + " entrou com mensalidade em atraso";
        String body = "Entrada às " + HM.format(event.getEventTime().atZone(zone)) + ". Em aberto desde "
                + DAY.format(oldest.getDueDate()) + ".";
        try {
            List<GymMember> staff = new java.util.ArrayList<>(
                    gymMemberRepository.findAllByGymIdAndRole(event.getGymId(), GymRole.OWNER));
            staff.addAll(gymMemberRepository.findAllByGymIdAndRole(event.getGymId(), GymRole.INSTRUCTOR));
            for (GymMember member : staff) {
                notificationService.notify(member.getUserId(), NotificationType.ACADEMY, title, body,
                        "user:" + studentUserId);
            }
        } catch (RuntimeException failed) {
            // An alert must never stop the passage from counting.
            log.warn("Overdue entry alert for member {} failed: {}", studentUserId, failed.getMessage());
        }
    }
}
