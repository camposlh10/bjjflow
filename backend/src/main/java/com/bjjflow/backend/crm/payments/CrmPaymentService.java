package com.bjjflow.backend.crm.payments;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.crm.payments.CrmPaymentDtos.CreateInvoiceRequest;
import com.bjjflow.backend.crm.payments.CrmPaymentDtos.CreatePaymentPlanRequest;
import com.bjjflow.backend.crm.payments.CrmPaymentDtos.GenerateInvoicesResponse;
import com.bjjflow.backend.crm.payments.CrmPaymentDtos.InvoiceResponse;
import com.bjjflow.backend.crm.payments.CrmPaymentDtos.MarkInvoicePaidRequest;
import com.bjjflow.backend.crm.payments.CrmPaymentDtos.PaymentPlanResponse;
import com.bjjflow.backend.crm.payments.CrmPaymentDtos.PaymentSummaryResponse;
import com.bjjflow.backend.crm.payments.CrmPaymentDtos.RevenuePoint;
import com.bjjflow.backend.crm.payments.CrmPaymentDtos.RevenueSeriesResponse;
import com.bjjflow.backend.crm.payments.CrmPaymentDtos.UpdatePaymentPlanRequest;
import com.bjjflow.backend.crm.security.CrmAccessService;
import com.bjjflow.backend.crm.security.CrmPrincipal;
import com.bjjflow.backend.gyms.GymMemberRepository;
import com.bjjflow.backend.payments.BillingCycle;
import com.bjjflow.backend.payments.Invoice;
import com.bjjflow.backend.payments.InvoiceRepository;
import com.bjjflow.backend.payments.PaymentPlan;
import com.bjjflow.backend.payments.PaymentPlanRepository;
import com.bjjflow.backend.payments.PaymentProvider;
import com.bjjflow.backend.payments.PaymentStatus;
import com.bjjflow.backend.payments.PaymentTransaction;
import com.bjjflow.backend.payments.PaymentTransactionRepository;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CrmPaymentService {

    /**
     * Safety cap on catch-up periods generated per plan in one run, so a plan
     * with a far-past due date cannot flood the gym with invoices.
     */
    private static final int MAX_GENERATED_PERIODS_PER_PLAN = 36;

    private final CrmAccessService crmAccessService;
    private final GymMemberRepository gymMemberRepository;
    private final UserRepository userRepository;
    private final PaymentPlanRepository paymentPlanRepository;
    private final InvoiceRepository invoiceRepository;
    private final PaymentTransactionRepository paymentTransactionRepository;

    @Transactional
    public PaymentPlanResponse createPaymentPlan(Long userId, CreatePaymentPlanRequest request) {
        CrmPrincipal crm = crmAccessService.requireOwner(userId);
        requireMember(crm.gymId(), request.memberUserId());

        LocalDate startDate = request.startDate() == null ? LocalDate.now() : request.startDate();
        LocalDate nextDueDate = request.nextDueDate() == null ? startDate : request.nextDueDate();
        if (nextDueDate.isBefore(startDate)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DUE_DATE",
                    "nextDueDate cannot be before startDate");
        }

        PaymentPlan plan = new PaymentPlan();
        plan.setGymId(crm.gymId());
        plan.setMemberUserId(request.memberUserId());
        plan.setName(request.name().trim());
        plan.setAmount(request.amount());
        plan.setBillingCycle(parseBillingCycle(request.billingCycle()));
        plan.setStartDate(startDate);
        plan.setNextDueDate(nextDueDate);
        plan.setActive(true);
        return paymentPlanResponse(paymentPlanRepository.save(plan));
    }

    @Transactional(readOnly = true)
    public List<PaymentPlanResponse> paymentPlans(Long userId) {
        CrmPrincipal crm = crmAccessService.requireOwner(userId);
        return paymentPlanResponses(paymentPlanRepository.findAllByGymIdOrderByCreatedAtDesc(crm.gymId()));
    }

    @Transactional(readOnly = true)
    public List<PaymentPlanResponse> paymentPlansForMember(Long userId, Long memberUserId) {
        CrmPrincipal crm = crmAccessService.requireOwner(userId);
        requireMember(crm.gymId(), memberUserId);
        return paymentPlanResponses(
                paymentPlanRepository.findAllByGymIdAndMemberUserIdOrderByCreatedAtDesc(crm.gymId(), memberUserId));
    }

    @Transactional
    public PaymentPlanResponse updatePaymentPlan(Long userId, Long planId, UpdatePaymentPlanRequest request) {
        CrmPrincipal crm = crmAccessService.requireOwner(userId);
        PaymentPlan plan = planInGym(planId, crm.gymId());

        if (request.name() != null) {
            if (request.name().isBlank()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PLAN_NAME", "Plan name is invalid");
            }
            plan.setName(request.name().trim());
        }
        if (request.amount() != null) {
            plan.setAmount(request.amount());
        }
        if (request.billingCycle() != null) {
            plan.setBillingCycle(parseBillingCycle(request.billingCycle()));
        }
        if (request.nextDueDate() != null) {
            if (request.nextDueDate().isBefore(plan.getStartDate())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DUE_DATE",
                        "nextDueDate cannot be before startDate");
            }
            plan.setNextDueDate(request.nextDueDate());
        }
        if (request.active() != null) {
            plan.setActive(request.active());
        }
        return paymentPlanResponse(paymentPlanRepository.save(plan));
    }

    @Transactional
    public PaymentPlanResponse deactivatePaymentPlan(Long userId, Long planId) {
        CrmPrincipal crm = crmAccessService.requireOwner(userId);
        PaymentPlan plan = planInGym(planId, crm.gymId());
        plan.setActive(false);
        return paymentPlanResponse(paymentPlanRepository.save(plan));
    }

    @Transactional
    public InvoiceResponse createInvoice(Long userId, CreateInvoiceRequest request) {
        CrmPrincipal crm = crmAccessService.requireOwner(userId);
        PaymentPlan plan = request.paymentPlanId() == null ? null
                : paymentPlanRepository.findByIdAndGymId(request.paymentPlanId(), crm.gymId())
                        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "PAYMENT_PLAN_NOT_FOUND",
                                "Payment plan not found"));

        Long memberUserId = request.memberUserId() != null
                ? request.memberUserId()
                : plan == null ? null : plan.getMemberUserId();
        if (memberUserId == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "MEMBER_REQUIRED", "memberUserId is required");
        }
        requireMember(crm.gymId(), memberUserId);
        if (plan != null && !memberUserId.equals(plan.getMemberUserId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PLAN_MEMBER_MISMATCH",
                    "Payment plan belongs to a different member");
        }

        String description = request.description() == null || request.description().isBlank()
                ? plan == null ? null : plan.getName()
                : request.description().trim();
        BigDecimal amount = request.amount() == null ? plan == null ? null : plan.getAmount() : request.amount();
        LocalDate dueDate = request.dueDate() == null
                ? plan == null ? null : plan.getNextDueDate()
                : request.dueDate();
        if (description == null || amount == null || dueDate == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVOICE_FIELDS_REQUIRED",
                    "description, amount, and dueDate are required without a payment plan");
        }
        if (amount.signum() <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_AMOUNT", "amount must be positive");
        }
        if (plan != null && invoiceRepository.existsByPaymentPlanIdAndDueDate(plan.getId(), dueDate)) {
            throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_INVOICE",
                    "An invoice for this plan and due date already exists");
        }

        return invoiceResponse(invoiceRepository.save(
                newInvoice(crm.gymId(), memberUserId, plan == null ? null : plan.getId(),
                        description, amount, dueDate)));
    }

    @Transactional
    public GenerateInvoicesResponse generateDueInvoices(Long userId) {
        CrmPrincipal crm = crmAccessService.requireOwner(userId);
        LocalDate today = LocalDate.now();
        List<PaymentPlan> duePlans = paymentPlanRepository
                .findAllByGymIdAndActiveTrueAndNextDueDateLessThanEqualOrderByIdAsc(crm.gymId(), today);

        List<Invoice> created = new ArrayList<>();
        int skipped = 0;
        for (PaymentPlan plan : duePlans) {
            int generated = 0;
            while (!plan.getNextDueDate().isAfter(today) && generated++ < MAX_GENERATED_PERIODS_PER_PLAN) {
                LocalDate dueDate = plan.getNextDueDate();
                if (invoiceRepository.existsByPaymentPlanIdAndDueDate(plan.getId(), dueDate)) {
                    skipped++;
                } else {
                    created.add(invoiceRepository.save(newInvoice(
                            plan.getGymId(), plan.getMemberUserId(), plan.getId(),
                            plan.getName(), plan.getAmount(), dueDate)));
                }
                plan.setNextDueDate(plan.getBillingCycle().nextDate(dueDate));
            }
            paymentPlanRepository.save(plan);
        }
        return new GenerateInvoicesResponse(created.size(), skipped, invoiceResponses(created));
    }

    @Transactional
    public List<InvoiceResponse> invoices(Long userId) {
        CrmPrincipal crm = crmAccessService.requireOwner(userId);
        ageOverdueInvoices(crm.gymId());
        return invoiceResponses(invoiceRepository.findAllByGymIdOrderByDueDateDescIdDesc(crm.gymId()));
    }

    @Transactional
    public List<InvoiceResponse> invoicesForMember(Long userId, Long memberUserId) {
        CrmPrincipal crm = crmAccessService.requireOwner(userId);
        requireMember(crm.gymId(), memberUserId);
        ageOverdueInvoices(crm.gymId());
        return invoiceResponses(
                invoiceRepository.findAllByGymIdAndMemberUserIdOrderByDueDateDescIdDesc(crm.gymId(), memberUserId));
    }

    @Transactional
    public List<InvoiceResponse> overdueInvoices(Long userId) {
        CrmPrincipal crm = crmAccessService.requireOwner(userId);
        ageOverdueInvoices(crm.gymId());
        return invoiceResponses(
                invoiceRepository.findAllByGymIdAndStatusOrderByDueDateAscIdAsc(crm.gymId(), PaymentStatus.OVERDUE));
    }

    @Transactional
    public InvoiceResponse markPaid(Long userId, Long invoiceId, MarkInvoicePaidRequest request) {
        CrmPrincipal crm = crmAccessService.requireOwner(userId);
        Invoice invoice = invoiceRepository.findForUpdate(invoiceId, crm.gymId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "INVOICE_NOT_FOUND", "Invoice not found"));
        if (invoice.getStatus() == PaymentStatus.CANCELLED) {
            throw new ApiException(HttpStatus.CONFLICT, "INVOICE_CANCELLED", "Cancelled invoice cannot be paid");
        }

        if (invoice.getStatus() != PaymentStatus.PAID) {
            Instant paidAt = Instant.now();
            PaymentProvider provider = request == null || request.provider() == null
                    ? PaymentProvider.MANUAL
                    : parseProvider(request.provider());
            invoice.setStatus(PaymentStatus.PAID);
            invoice.setProvider(provider);
            invoice.setPaidAt(paidAt);
            invoiceRepository.save(invoice);

            if (paymentTransactionRepository.findByInvoiceId(invoice.getId()).isEmpty()) {
                PaymentTransaction transaction = new PaymentTransaction();
                transaction.setGymId(crm.gymId());
                transaction.setInvoiceId(invoice.getId());
                transaction.setAmount(invoice.getAmount());
                transaction.setProvider(provider);
                transaction.setExternalTransactionId(
                        request == null ? null : trimToNull(request.externalTransactionId()));
                transaction.setPaidAt(paidAt);
                transaction.setNotes(request == null || trimToNull(request.notes()) == null
                        ? "Marked paid manually in CRM"
                        : request.notes().trim());
                paymentTransactionRepository.save(transaction);
            }
            clearDelinquencyIfSettled(crm.gymId(), invoice.getMemberUserId());
        }
        return invoiceResponse(invoice);
    }

    /** Removes the delinquent flag once the member has no overdue invoices left. */
    private void clearDelinquencyIfSettled(Long gymId, Long memberUserId) {
        gymMemberRepository.findByGymIdAndUserId(gymId, memberUserId).ifPresent(member -> {
            if (member.getDelinquentSince() != null
                    && !invoiceRepository.existsByGymIdAndMemberUserIdAndStatus(
                            gymId, memberUserId, PaymentStatus.OVERDUE)) {
                member.setDelinquentSince(null);
                gymMemberRepository.save(member);
            }
        });
    }

    @Transactional
    public InvoiceResponse cancelInvoice(Long userId, Long invoiceId) {
        CrmPrincipal crm = crmAccessService.requireOwner(userId);
        Invoice invoice = invoiceRepository.findForUpdate(invoiceId, crm.gymId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "INVOICE_NOT_FOUND", "Invoice not found"));
        if (invoice.getStatus() == PaymentStatus.PAID) {
            throw new ApiException(HttpStatus.CONFLICT, "INVOICE_ALREADY_PAID", "Paid invoice cannot be cancelled");
        }
        if (invoice.getStatus() != PaymentStatus.CANCELLED) {
            invoice.setStatus(PaymentStatus.CANCELLED);
            invoiceRepository.save(invoice);
        }
        return invoiceResponse(invoice);
    }

    @Transactional
    public PaymentSummaryResponse summary(Long userId) {
        CrmPrincipal crm = crmAccessService.requireOwner(userId);
        ageOverdueInvoices(crm.gymId());

        LocalDate monthStart = LocalDate.now(ZoneOffset.UTC).withDayOfMonth(1);
        Instant from = monthStart.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant to = monthStart.plusMonths(1).atStartOfDay(ZoneOffset.UTC).toInstant();

        return new PaymentSummaryResponse(
                paymentPlanRepository.countByGymIdAndActiveTrue(crm.gymId()),
                invoiceRepository.countByGymIdAndStatus(crm.gymId(), PaymentStatus.PENDING),
                zeroIfNull(invoiceRepository.sumAmountByGymIdAndStatus(crm.gymId(), PaymentStatus.PENDING)),
                invoiceRepository.countByGymIdAndStatus(crm.gymId(), PaymentStatus.OVERDUE),
                zeroIfNull(invoiceRepository.sumAmountByGymIdAndStatus(crm.gymId(), PaymentStatus.OVERDUE)),
                paymentTransactionRepository.countByGymIdAndPaidAtGreaterThanEqualAndPaidAtLessThan(
                        crm.gymId(), from, to),
                zeroIfNull(paymentTransactionRepository.sumAmountByGymIdAndPaidAtBetween(crm.gymId(), from, to)));
    }

    /**
     * Daily collected revenue for the trailing window (default 30 days),
     * with zero-filled days so charts can consume it directly.
     */
    @Transactional(readOnly = true)
    public RevenueSeriesResponse revenueSeries(Long userId, Integer days) {
        CrmPrincipal crm = crmAccessService.requireOwner(userId);
        int window = days == null ? 30 : Math.min(Math.max(days, 1), 365);
        ZoneId zone = ZoneId.systemDefault();
        LocalDate to = LocalDate.now(zone);
        LocalDate from = to.minusDays(window - 1L);

        Map<LocalDate, BigDecimal> amounts = new HashMap<>();
        Map<LocalDate, Long> counts = new HashMap<>();
        paymentTransactionRepository
                .findAllByGymIdAndPaidAtGreaterThanEqualAndPaidAtLessThanOrderByPaidAtAsc(
                        crm.gymId(),
                        from.atStartOfDay(zone).toInstant(),
                        to.plusDays(1).atStartOfDay(zone).toInstant())
                .forEach(transaction -> {
                    LocalDate day = transaction.getPaidAt().atZone(zone).toLocalDate();
                    amounts.merge(day, transaction.getAmount(), BigDecimal::add);
                    counts.merge(day, 1L, Long::sum);
                });

        List<RevenuePoint> points = new ArrayList<>(window);
        BigDecimal total = BigDecimal.ZERO;
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            BigDecimal amount = amounts.getOrDefault(day, BigDecimal.ZERO);
            total = total.add(amount);
            points.add(new RevenuePoint(day, amount, counts.getOrDefault(day, 0L)));
        }
        return new RevenueSeriesResponse(from, to, total, points);
    }

    private static final java.security.SecureRandom REFERENCE_RANDOM = new java.security.SecureRandom();
    private static final String REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private static Invoice newInvoice(Long gymId, Long memberUserId, Long paymentPlanId,
            String description, BigDecimal amount, LocalDate dueDate) {
        Invoice invoice = new Invoice();
        invoice.setGymId(gymId);
        invoice.setMemberUserId(memberUserId);
        invoice.setPaymentPlanId(paymentPlanId);
        invoice.setDescription(description);
        invoice.setAmount(amount);
        invoice.setDueDate(dueDate);
        invoice.setStatus(dueDate.isBefore(LocalDate.now()) ? PaymentStatus.OVERDUE : PaymentStatus.PENDING);
        invoice.setProvider(PaymentProvider.MANUAL);
        invoice.setPaymentReference(newPaymentReference());
        return invoice;
    }

    /** Short code the attendant ties to the card-machine sale (POS matching). */
    private static String newPaymentReference() {
        StringBuilder code = new StringBuilder("PGT-");
        for (int i = 0; i < 8; i++) {
            code.append(REFERENCE_ALPHABET.charAt(REFERENCE_RANDOM.nextInt(REFERENCE_ALPHABET.length())));
        }
        return code.toString();
    }

    private void ageOverdueInvoices(Long gymId) {
        invoiceRepository.markOverdue(gymId, LocalDate.now(), Instant.now(),
                PaymentStatus.PENDING, PaymentStatus.OVERDUE);
    }

    private PaymentPlan planInGym(Long planId, Long gymId) {
        return paymentPlanRepository.findByIdAndGymId(planId, gymId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "PAYMENT_PLAN_NOT_FOUND",
                        "Payment plan not found"));
    }

    private void requireMember(Long gymId, Long memberUserId) {
        if (gymMemberRepository.findByGymIdAndUserId(gymId, memberUserId).isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "Member not found");
        }
    }

    private List<PaymentPlanResponse> paymentPlanResponses(List<PaymentPlan> plans) {
        Map<Long, String> memberNames = memberNames(
                plans.stream().map(PaymentPlan::getMemberUserId).collect(Collectors.toSet()));
        return plans.stream()
                .map(plan -> paymentPlanResponse(plan, memberNames.get(plan.getMemberUserId())))
                .toList();
    }

    private PaymentPlanResponse paymentPlanResponse(PaymentPlan plan) {
        return paymentPlanResponse(plan, memberName(plan.getMemberUserId()));
    }

    private PaymentPlanResponse paymentPlanResponse(PaymentPlan plan, String memberName) {
        return new PaymentPlanResponse(
                plan.getId(), plan.getGymId(), plan.getMemberUserId(), memberName,
                plan.getName(), plan.getAmount(), plan.getBillingCycle().name(), plan.getStartDate(),
                plan.getNextDueDate(), Boolean.TRUE.equals(plan.getActive()), plan.getCreatedAt());
    }

    private List<InvoiceResponse> invoiceResponses(List<Invoice> invoices) {
        if (invoices.isEmpty()) {
            return List.of();
        }
        Map<Long, String> memberNames = memberNames(
                invoices.stream().map(Invoice::getMemberUserId).collect(Collectors.toSet()));
        Map<Long, Long> transactionIds = paymentTransactionRepository
                .findAllByInvoiceIdIn(invoices.stream().map(Invoice::getId).toList()).stream()
                .collect(Collectors.toMap(PaymentTransaction::getInvoiceId, PaymentTransaction::getId));
        return invoices.stream()
                .map(invoice -> invoiceResponse(invoice,
                        memberNames.get(invoice.getMemberUserId()),
                        transactionIds.get(invoice.getId())))
                .toList();
    }

    private InvoiceResponse invoiceResponse(Invoice invoice) {
        Long transactionId = paymentTransactionRepository.findByInvoiceId(invoice.getId())
                .map(PaymentTransaction::getId).orElse(null);
        return invoiceResponse(invoice, memberName(invoice.getMemberUserId()), transactionId);
    }

    private InvoiceResponse invoiceResponse(Invoice invoice, String memberName, Long transactionId) {
        return new InvoiceResponse(
                invoice.getId(), invoice.getGymId(), invoice.getMemberUserId(), memberName,
                invoice.getPaymentPlanId(), invoice.getDescription(), invoice.getAmount(), invoice.getDueDate(),
                invoice.getStatus().name(), invoice.getProvider().name(), invoice.getPaymentReference(),
                invoice.getPaidAt(), transactionId, invoice.getCreatedAt());
    }

    private Map<Long, String> memberNames(Set<Long> memberUserIds) {
        if (memberUserIds.isEmpty()) {
            return Map.of();
        }
        return userRepository.findAllById(memberUserIds).stream()
                .collect(Collectors.toMap(User::getId, User::getDisplayName, (a, b) -> a));
    }

    private String memberName(Long memberUserId) {
        return userRepository.findById(memberUserId).map(User::getDisplayName).orElse(null);
    }

    private static BigDecimal zeroIfNull(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static BillingCycle parseBillingCycle(String value) {
        return parseEnum(BillingCycle.class, value, "INVALID_BILLING_CYCLE", "Invalid billing cycle");
    }

    private static PaymentProvider parseProvider(String value) {
        return parseEnum(PaymentProvider.class, value, "INVALID_PROVIDER", "Invalid payment provider");
    }

    private static <E extends Enum<E>> E parseEnum(Class<E> type, String value, String code, String message) {
        try {
            return Enum.valueOf(type, value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, code, message);
        }
    }
}
