package com.bjjflow.backend.crm.dashboard;

import java.time.LocalDate;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.classes.ClassAttendanceRepository;
import com.bjjflow.backend.classes.GymClassRepository;
import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.crm.dashboard.CrmDashboardDtos.DashboardResponse;
import com.bjjflow.backend.crm.security.CrmAccessService;
import com.bjjflow.backend.crm.security.CrmPrincipal;
import com.bjjflow.backend.gyms.Gym;
import com.bjjflow.backend.gyms.GymMemberRepository;
import com.bjjflow.backend.gyms.GymRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CrmDashboardService {

    private final CrmAccessService crmAccessService;
    private final GymMemberRepository gymMemberRepository;
    private final GymRepository gymRepository;
    private final GymClassRepository gymClassRepository;
    private final ClassAttendanceRepository classAttendanceRepository;

    @Transactional(readOnly = true)
    public DashboardResponse dashboard(Long userId) {
        CrmPrincipal crm = crmAccessService.requireStaff(userId);
        Long gymId = crm.gymId();
        Gym gym = gymRepository.findById(gymId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "GYM_NOT_FOUND", "Gym not found"));

        LocalDate today = LocalDate.now();
        long totalMembers = gymMemberRepository.countByGymId(gymId);
        long activeClasses = gymClassRepository.countByGymIdAndActiveTrue(gymId);
        long todayClasses = gymClassRepository.countByGymIdAndDayOfWeekAndActiveTrue(
                gymId, today.getDayOfWeek().getValue());
        long todayCheckIns = classAttendanceRepository.countAttendedInGymBetween(gymId, today, today);
        long monthlyCheckIns = classAttendanceRepository.countAttendedInGymBetween(
                gymId, today.withDayOfMonth(1), today);

        return new DashboardResponse(gymId, gym.getName(), totalMembers, activeClasses, todayClasses,
                todayCheckIns, monthlyCheckIns);
    }
}
