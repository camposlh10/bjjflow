package com.bjjflow.backend.gyms;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.gyms.StudentAdminDtos.CreateNoteRequest;
import com.bjjflow.backend.gyms.StudentAdminDtos.NoteDto;
import com.bjjflow.backend.gyms.StudentAdminDtos.StudentAdminDto;
import com.bjjflow.backend.pain.PainAssessmentDtos.AssessmentDto;
import com.bjjflow.backend.pain.PainAssessmentDtos.AssessmentSummaryDto;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/gyms/me/students")
@RequiredArgsConstructor
public class StudentAdminController {

    private final StudentAdminService studentAdminService;

    private static Long userId(Authentication auth) {
        return Long.parseLong(auth.getName());
    }

    @GetMapping("/{userId}")
    public StudentAdminDto student(Authentication auth, @PathVariable("userId") Long studentUserId) {
        return studentAdminService.student(userId(auth), studentUserId);
    }

    @GetMapping("/{userId}/notes")
    public List<NoteDto> notes(Authentication auth, @PathVariable("userId") Long studentUserId) {
        return studentAdminService.notes(userId(auth), studentUserId);
    }

    @GetMapping("/{userId}/pain-assessments")
    public List<AssessmentSummaryDto> painAssessments(Authentication auth, @PathVariable("userId") Long studentUserId) {
        return studentAdminService.painAssessments(userId(auth), studentUserId);
    }

    @GetMapping("/{userId}/pain-assessments/{assessmentId}")
    public AssessmentDto painAssessment(Authentication auth, @PathVariable("userId") Long studentUserId,
            @PathVariable Long assessmentId) {
        return studentAdminService.painAssessment(userId(auth), studentUserId, assessmentId);
    }

    @PostMapping("/{userId}/notes")
    public NoteDto addNote(Authentication auth, @PathVariable("userId") Long studentUserId,
            @Valid @RequestBody CreateNoteRequest request) {
        return studentAdminService.addNote(userId(auth), studentUserId, request);
    }

    @DeleteMapping("/{userId}/notes/{noteId}")
    public ResponseEntity<Void> deleteNote(Authentication auth, @PathVariable("userId") Long studentUserId,
            @PathVariable Long noteId) {
        studentAdminService.deleteNote(userId(auth), noteId);
        return ResponseEntity.noContent().build();
    }
}
