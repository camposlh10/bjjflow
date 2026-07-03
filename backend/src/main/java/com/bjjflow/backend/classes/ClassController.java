package com.bjjflow.backend.classes;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.classes.ClassDtos.AgendaOccurrenceDto;
import com.bjjflow.backend.classes.ClassDtos.AttendeeDto;
import com.bjjflow.backend.classes.ClassDtos.CheckInClassRequest;
import com.bjjflow.backend.classes.ClassDtos.ClassDto;
import com.bjjflow.backend.classes.ClassDtos.CreateClassRequest;
import com.bjjflow.backend.classes.ClassDtos.MarkAttendanceRequest;
import com.bjjflow.backend.classes.ClassDtos.RosterEntryDto;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/gyms/classes")
@RequiredArgsConstructor
public class ClassController {

    private final ClassService classService;

    private static Long userId(Authentication auth) {
        return Long.parseLong(auth.getName());
    }

    @GetMapping
    public List<ClassDto> list(Authentication auth) {
        return classService.listClasses(userId(auth));
    }

    @PostMapping
    public ClassDto create(Authentication auth, @Valid @RequestBody CreateClassRequest request) {
        return classService.createClass(userId(auth), request);
    }

    @DeleteMapping("/{id}")
    public void delete(Authentication auth, @PathVariable Long id) {
        classService.deleteClass(userId(auth), id);
    }

    @GetMapping("/agenda")
    public List<AgendaOccurrenceDto> agenda(Authentication auth,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return classService.agenda(userId(auth), from, to);
    }

    @PostMapping("/{id}/checkin")
    public AgendaOccurrenceDto checkin(Authentication auth, @PathVariable Long id,
            @Valid @RequestBody CheckInClassRequest request) {
        return classService.checkIn(userId(auth), id, request.date());
    }

    @PostMapping("/{id}/reserve")
    public AgendaOccurrenceDto reserve(Authentication auth, @PathVariable Long id,
            @Valid @RequestBody ClassDtos.ReserveRequest request) {
        return classService.reserve(userId(auth), id, request.date());
    }

    @GetMapping("/{id}/attendees")
    public List<AttendeeDto> attendees(Authentication auth, @PathVariable Long id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return classService.attendees(userId(auth), id, date);
    }

    @GetMapping("/{id}/roster")
    public List<RosterEntryDto> roster(Authentication auth, @PathVariable Long id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return classService.roster(userId(auth), id, date);
    }

    @PostMapping("/{id}/attendance")
    public void mark(Authentication auth, @PathVariable Long id, @Valid @RequestBody MarkAttendanceRequest request) {
        classService.markAttendance(userId(auth), id, request.date(), request.userId(), request.present());
    }
}
