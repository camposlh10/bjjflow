package com.bjjflow.backend.crm.security;

import com.bjjflow.backend.gyms.GymRole;

public record CrmPrincipal(
        Long userId,
        Long gymId,
        GymRole role) {

    public boolean isOwner() {
        return role == GymRole.OWNER;
    }

    public boolean isStaff() {
        return role == GymRole.OWNER || role == GymRole.INSTRUCTOR;
    }
}
