package com.bjjflow.backend.crm.pos;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.access.DeviceKeys;
import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.crm.pos.CrmPosDtos.CreateIntegrationRequest;
import com.bjjflow.backend.crm.pos.CrmPosDtos.IntegrationResponse;
import com.bjjflow.backend.crm.pos.CrmPosDtos.IntegrationWithKeyResponse;
import com.bjjflow.backend.crm.pos.CrmPosDtos.PosEventResponse;
import com.bjjflow.backend.crm.security.CrmAccessService;
import com.bjjflow.backend.crm.security.CrmPrincipal;
import com.bjjflow.backend.payments.Invoice;
import com.bjjflow.backend.payments.InvoiceRepository;
import com.bjjflow.backend.payments.PosIntegration;
import com.bjjflow.backend.payments.PosIntegrationRepository;
import com.bjjflow.backend.payments.PosWebhookEvent;
import com.bjjflow.backend.payments.PosWebhookEventRepository;
import com.bjjflow.backend.payments.PosWebhookProcessor;
import com.bjjflow.backend.payments.PosWebhookStatus;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CrmPosService {

    private static final int LOG_SIZE = 100;
    private static final Set<PosWebhookStatus> RESOLVABLE = Set.of(
            PosWebhookStatus.UNRESOLVED_INVOICE, PosWebhookStatus.AMOUNT_MISMATCH,
            PosWebhookStatus.FAILED, PosWebhookStatus.IGNORED);

    private final CrmAccessService crmAccessService;
    private final PosIntegrationRepository posIntegrationRepository;
    private final PosWebhookEventRepository posWebhookEventRepository;
    private final PosWebhookProcessor posWebhookProcessor;
    private final InvoiceRepository invoiceRepository;
    private final UserRepository userRepository;

    @Transactional
    public IntegrationWithKeyResponse register(Long userId, CreateIntegrationRequest request) {
        CrmPrincipal crm = crmAccessService.requireOwner(userId);
        String webhookKey = DeviceKeys.generate("bjjp");

        PosIntegration integration = new PosIntegration();
        integration.setGymId(crm.gymId());
        integration.setName(request.name().trim());
        integration.setProviderName(request.providerName().trim());
        integration.setActive(true);
        integration.setApiKeyHash(DeviceKeys.hash(webhookKey));
        return new IntegrationWithKeyResponse(
                response(posIntegrationRepository.save(integration)), webhookKey);
    }

    @Transactional(readOnly = true)
    public List<IntegrationResponse> list(Long userId) {
        CrmPrincipal crm = crmAccessService.requireStaff(userId);
        return posIntegrationRepository.findAllByGymIdOrderByIdAsc(crm.gymId()).stream()
                .map(this::response)
                .toList();
    }

    @Transactional
    public IntegrationWithKeyResponse rotateKey(Long userId, Long integrationId) {
        CrmPrincipal crm = crmAccessService.requireOwner(userId);
        PosIntegration integration = integrationInGym(integrationId, crm.gymId());
        String webhookKey = DeviceKeys.generate("bjjp");
        integration.setApiKeyHash(DeviceKeys.hash(webhookKey));
        return new IntegrationWithKeyResponse(
                response(posIntegrationRepository.save(integration)), webhookKey);
    }

    @Transactional
    public IntegrationResponse deactivate(Long userId, Long integrationId) {
        CrmPrincipal crm = crmAccessService.requireOwner(userId);
        PosIntegration integration = integrationInGym(integrationId, crm.gymId());
        integration.setActive(false);
        return response(posIntegrationRepository.save(integration));
    }

    @Transactional(readOnly = true)
    public List<PosEventResponse> events(Long userId) {
        CrmPrincipal crm = crmAccessService.requireOwner(userId);
        List<PosWebhookEvent> events = posWebhookEventRepository
                .findAllByGymIdOrderByCreatedAtDescIdDesc(crm.gymId(), PageRequest.of(0, LOG_SIZE));

        Map<Long, String> integrationNames = posIntegrationRepository
                .findAllByGymIdOrderByIdAsc(crm.gymId()).stream()
                .collect(Collectors.toMap(PosIntegration::getId, PosIntegration::getName));
        Map<Long, Invoice> invoices = invoiceRepository.findAllById(events.stream()
                .map(PosWebhookEvent::getInvoiceId).filter(Objects::nonNull).toList()).stream()
                .collect(Collectors.toMap(Invoice::getId, invoice -> invoice));
        Map<Long, String> memberNames = userRepository.findAllById(invoices.values().stream()
                .map(Invoice::getMemberUserId).collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(User::getId, User::getDisplayName, (a, b) -> a));

        return events.stream().map(event -> {
            Invoice invoice = event.getInvoiceId() == null ? null : invoices.get(event.getInvoiceId());
            return new PosEventResponse(
                    event.getId(),
                    integrationNames.get(event.getIntegrationId()),
                    event.getExternalTransactionId(),
                    event.getPaymentReference(),
                    event.getInvoiceId(),
                    invoice == null ? null : invoice.getDescription(),
                    invoice == null ? null : invoice.getMemberUserId(),
                    invoice == null ? null : memberNames.get(invoice.getMemberUserId()),
                    event.getAmount(),
                    event.getPaymentMethod() == null ? null : event.getPaymentMethod().name(),
                    event.getCardBrand(),
                    event.getInstallments(),
                    event.getAuthorizationCode(),
                    event.getStatus().name(),
                    event.getNotes(),
                    event.getPaidAt(),
                    event.getCreatedAt());
        }).toList();
    }

    @Transactional
    public PosEventResponse linkInvoice(Long userId, Long eventId, Long invoiceId) {
        CrmPrincipal crm = crmAccessService.requireOwner(userId);
        PosWebhookEvent event = eventInGym(eventId, crm.gymId());
        if (!RESOLVABLE.contains(event.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "EVENT_NOT_RESOLVABLE",
                    "This transaction was already processed");
        }
        Invoice invoice = invoiceRepository.findByIdAndGymId(invoiceId, crm.gymId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "INVOICE_NOT_FOUND",
                        "Invoice not found"));
        posWebhookProcessor.linkInvoice(event, invoice);
        return events(userId).stream()
                .filter(item -> item.id().equals(eventId))
                .findFirst()
                .orElseThrow();
    }

    @Transactional
    public PosEventResponse ignore(Long userId, Long eventId) {
        CrmPrincipal crm = crmAccessService.requireOwner(userId);
        PosWebhookEvent event = eventInGym(eventId, crm.gymId());
        if (event.getStatus() == PosWebhookStatus.PROCESSED) {
            throw new ApiException(HttpStatus.CONFLICT, "EVENT_NOT_RESOLVABLE",
                    "Processed transactions cannot be ignored");
        }
        event.setStatus(PosWebhookStatus.IGNORED);
        posWebhookEventRepository.save(event);
        return events(userId).stream()
                .filter(item -> item.id().equals(eventId))
                .findFirst()
                .orElseThrow();
    }

    private PosIntegration integrationInGym(Long integrationId, Long gymId) {
        return posIntegrationRepository.findByIdAndGymId(integrationId, gymId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "POS_INTEGRATION_NOT_FOUND",
                        "POS integration not found"));
    }

    private PosWebhookEvent eventInGym(Long eventId, Long gymId) {
        return posWebhookEventRepository.findByIdAndGymId(eventId, gymId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "POS_EVENT_NOT_FOUND",
                        "POS event not found"));
    }

    private IntegrationResponse response(PosIntegration integration) {
        return new IntegrationResponse(
                integration.getId(), integration.getGymId(), integration.getName(),
                integration.getProviderName(), Boolean.TRUE.equals(integration.getActive()),
                integration.getCreatedAt(), integration.getLastSeenAt());
    }
}
