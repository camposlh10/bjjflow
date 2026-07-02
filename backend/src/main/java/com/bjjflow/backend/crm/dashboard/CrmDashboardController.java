package com.bjjflow.backend.crm.dashboard;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.crm.dashboard.CrmDashboardDtos.DashboardResponse;

import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
public class CrmDashboardController {

    private final CrmDashboardService crmDashboardService;

    @GetMapping("/api/v1/crm/dashboard")
    public DashboardResponse dashboard(Authentication auth) {
        return crmDashboardService.dashboard(Long.parseLong(auth.getName()));
    }
}
