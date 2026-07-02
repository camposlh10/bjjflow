package com.bjjflow.backend.crm.attendance;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.crm.attendance.CrmAttendanceDtos.AttendanceChangeResponse;
import com.bjjflow.backend.crm.attendance.CrmAttendanceDtos.AttendanceResponse;
import com.bjjflow.backend.crm.attendance.CrmAttendanceDtos.AccessEventReviewResponse;
import com.bjjflow.backend.crm.attendance.CrmAttendanceDtos.MarkAttendanceRequest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/crm/attendance")
@RequiredArgsConstructor
public class CrmAttendanceController {

    private final CrmAttendanceService crmAttendanceService;

    @PostMapping
    public AttendanceChangeResponse mark(Authentication auth,
            @Valid @RequestBody MarkAttendanceRequest request) {
        return crmAttendanceService.mark(Long.parseLong(auth.getName()), request);
    }

    @GetMapping("/today")
    public List<AttendanceResponse> today(Authentication auth) {
        return crmAttendanceService.today(Long.parseLong(auth.getName()));
    }

    @GetMapping("/member/{userId}")
    public List<AttendanceResponse> memberHistory(Authentication auth, @PathVariable Long userId) {
        return crmAttendanceService.memberHistory(Long.parseLong(auth.getName()), userId);
    }

    @GetMapping("/unresolved-access-events")
    public List<AccessEventReviewResponse> unresolvedAccessEvents(Authentication auth) {
        return crmAttendanceService.unresolvedAccessEvents(Long.parseLong(auth.getName()));
    }

    @PutMapping("/access-events/{eventId}/link-member/{userId}")
    public AccessEventReviewResponse linkMember(Authentication auth, @PathVariable Long eventId,
            @PathVariable Long userId) {
        return crmAttendanceService.linkMember(Long.parseLong(auth.getName()), eventId, userId);
    }

    @PutMapping("/access-events/{eventId}/mark-ignored")
    public AccessEventReviewResponse markIgnored(Authentication auth, @PathVariable Long eventId) {
        return crmAttendanceService.markIgnored(Long.parseLong(auth.getName()), eventId);
    }

    @PutMapping("/access-events/{eventId}/assign-class/{classId}")
    public AccessEventReviewResponse assignClass(Authentication auth, @PathVariable Long eventId,
            @PathVariable Long classId) {
        return crmAttendanceService.assignClass(Long.parseLong(auth.getName()), eventId, classId);
    }
}
