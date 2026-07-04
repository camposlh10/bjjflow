package com.bjjflow.backend.crm.pos;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.crm.pos.CrmPosDtos.CreateIntegrationRequest;
import com.bjjflow.backend.crm.pos.CrmPosDtos.IntegrationResponse;
import com.bjjflow.backend.crm.pos.CrmPosDtos.IntegrationWithKeyResponse;
import com.bjjflow.backend.crm.pos.CrmPosDtos.PosEventResponse;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/crm")
@RequiredArgsConstructor
public class CrmPosController {

    private final CrmPosService crmPosService;

    @PostMapping("/pos-integrations")
    public IntegrationWithKeyResponse register(Authentication auth,
            @Valid @RequestBody CreateIntegrationRequest request) {
        return crmPosService.register(userId(auth), request);
    }

    @GetMapping("/pos-integrations")
    public List<IntegrationResponse> list(Authentication auth) {
        return crmPosService.list(userId(auth));
    }

    @PostMapping("/pos-integrations/{integrationId}/rotate-key")
    public IntegrationWithKeyResponse rotateKey(Authentication auth, @PathVariable Long integrationId) {
        return crmPosService.rotateKey(userId(auth), integrationId);
    }

    @PutMapping("/pos-integrations/{integrationId}/deactivate")
    public IntegrationResponse deactivate(Authentication auth, @PathVariable Long integrationId) {
        return crmPosService.deactivate(userId(auth), integrationId);
    }

    @GetMapping("/pos-events")
    public List<PosEventResponse> events(Authentication auth) {
        return crmPosService.events(userId(auth));
    }

    @PutMapping("/pos-events/{eventId}/link-invoice/{invoiceId}")
    public PosEventResponse linkInvoice(Authentication auth, @PathVariable Long eventId,
            @PathVariable Long invoiceId) {
        return crmPosService.linkInvoice(userId(auth), eventId, invoiceId);
    }

    @PutMapping("/pos-events/{eventId}/ignore")
    public PosEventResponse ignore(Authentication auth, @PathVariable Long eventId) {
        return crmPosService.ignore(userId(auth), eventId);
    }

    private static Long userId(Authentication auth) {
        return Long.parseLong(auth.getName());
    }
}
