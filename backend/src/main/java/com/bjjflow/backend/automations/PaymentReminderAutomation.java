package com.bjjflow.backend.automations;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

import org.springframework.stereotype.Service;

import com.bjjflow.backend.gyms.GymMember;
import com.bjjflow.backend.gyms.GymMemberRepository;
import com.bjjflow.backend.gyms.GymRole;
import com.bjjflow.backend.notifications.NotificationType;
import com.bjjflow.backend.payments.Invoice;
import com.bjjflow.backend.payments.InvoiceRepository;
import com.bjjflow.backend.payments.PaymentStatus;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * Payment reminder ladder:
 * 7 and 3 days before due, on the due date, 3 and 7 days overdue, and at
 * 15 days overdue the member is flagged delinquent and the owners alerted.
 */
@Service
@RequiredArgsConstructor
public class PaymentReminderAutomation {

    private static final DateTimeFormatter BR_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final List<PaymentStatus> OPEN = List.of(PaymentStatus.PENDING, PaymentStatus.OVERDUE);

    private final InvoiceRepository invoiceRepository;
    private final GymMemberRepository gymMemberRepository;
    private final UserRepository userRepository;
    private final AutomationEvents automationEvents;

    public int run(LocalDate today) {
        int created = 0;
        created += remindUpcoming(today, 7, "Sua fatura \"%s\" de %s vence em %s.");
        created += remindUpcoming(today, 3, "Lembrete: a fatura \"%s\" de %s vence em %s.");
        created += remindDueToday(today);
        created += remindOverdue(today, 3);
        created += remindOverdue(today, 7);
        created += flagDelinquents(today);
        return created;
    }

    private int remindUpcoming(LocalDate today, int daysAhead, String template) {
        int created = 0;
        for (Invoice invoice : invoiceRepository.findAllByStatusInAndDueDate(
                List.of(PaymentStatus.PENDING), today.plusDays(daysAhead))) {
            String body = template.formatted(
                    invoice.getDescription(), money(invoice.getAmount()), BR_DATE.format(invoice.getDueDate()));
            if (automationEvents.fireOnce(invoice.getGymId(), AutomationEvents.PAYMENT_REMINDER,
                    "invoice-" + invoice.getId() + "-before" + daysAhead, invoice.getMemberUserId(),
                    NotificationType.SYSTEM, "Mensalidade a vencer", body)) {
                created++;
            }
        }
        return created;
    }

    private int remindDueToday(LocalDate today) {
        int created = 0;
        for (Invoice invoice : invoiceRepository.findAllByStatusInAndDueDate(OPEN, today)) {
            String body = "A fatura \"%s\" de %s vence hoje.".formatted(
                    invoice.getDescription(), money(invoice.getAmount()));
            if (automationEvents.fireOnce(invoice.getGymId(), AutomationEvents.PAYMENT_REMINDER,
                    "invoice-" + invoice.getId() + "-due", invoice.getMemberUserId(),
                    NotificationType.SYSTEM, "Fatura vence hoje", body)) {
                created++;
            }
        }
        return created;
    }

    private int remindOverdue(LocalDate today, int daysLate) {
        int created = 0;
        for (Invoice invoice : invoiceRepository.findAllByStatusInAndDueDate(OPEN, today.minusDays(daysLate))) {
            String body = "A fatura \"%s\" de %s está em atraso desde %s.".formatted(
                    invoice.getDescription(), money(invoice.getAmount()), BR_DATE.format(invoice.getDueDate()));
            if (automationEvents.fireOnce(invoice.getGymId(), AutomationEvents.PAYMENT_OVERDUE,
                    "invoice-" + invoice.getId() + "-late" + daysLate, invoice.getMemberUserId(),
                    NotificationType.SYSTEM, "Fatura em atraso", body)) {
                created++;
            }
        }
        return created;
    }

    private int flagDelinquents(LocalDate today) {
        int created = 0;
        for (Invoice invoice : invoiceRepository.findAllByStatusInAndDueDate(OPEN, today.minusDays(15))) {
            GymMember member = gymMemberRepository
                    .findByGymIdAndUserId(invoice.getGymId(), invoice.getMemberUserId()).orElse(null);
            String memberName = userRepository.findById(invoice.getMemberUserId())
                    .map(User::getDisplayName).orElse("Aluno");
            boolean fired = false;
            for (GymMember owner : gymMemberRepository.findAllByGymIdAndRole(invoice.getGymId(), GymRole.OWNER)) {
                String body = "%s está com a fatura \"%s\" (%s) vencida há 15 dias e foi marcado como inadimplente."
                        .formatted(memberName, invoice.getDescription(), money(invoice.getAmount()));
                fired |= automationEvents.fireOnce(invoice.getGymId(), AutomationEvents.DELINQUENT_FLAG,
                        "invoice-" + invoice.getId() + "-owner" + owner.getUserId(), owner.getUserId(),
                        NotificationType.SYSTEM, "Aluno inadimplente", body);
            }
            if (fired) {
                created++;
                if (member != null && member.getDelinquentSince() == null) {
                    member.setDelinquentSince(Instant.now());
                    gymMemberRepository.save(member);
                }
            }
        }
        return created;
    }

    static String money(BigDecimal amount) {
        return NumberFormat.getCurrencyInstance(Locale.forLanguageTag("pt-BR")).format(amount);
    }
}
