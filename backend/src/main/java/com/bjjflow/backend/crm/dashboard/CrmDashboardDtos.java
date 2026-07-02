package com.bjjflow.backend.crm.dashboard;

public final class CrmDashboardDtos {

    private CrmDashboardDtos() {
    }

    public record DashboardResponse(
            Long gymId,
            String gymName,
            long totalMembers,
            long activeClasses,
            long todayClasses,
            long todayCheckIns,
            long monthlyCheckIns) {
    }
}
