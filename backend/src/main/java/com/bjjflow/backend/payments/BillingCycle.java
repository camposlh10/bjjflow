package com.bjjflow.backend.payments;

import java.time.LocalDate;

public enum BillingCycle {
    WEEKLY,
    MONTHLY,
    QUARTERLY,
    SEMIANNUAL,
    ANNUAL;

    public LocalDate nextDate(LocalDate date) {
        return switch (this) {
            case WEEKLY -> date.plusWeeks(1);
            case MONTHLY -> date.plusMonths(1);
            case QUARTERLY -> date.plusMonths(3);
            case SEMIANNUAL -> date.plusMonths(6);
            case ANNUAL -> date.plusYears(1);
        };
    }
}
