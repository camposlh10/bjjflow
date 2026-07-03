package com.bjjflow.backend.pain;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.pain.PainAssessmentDtos.AssessmentDto;
import com.bjjflow.backend.pain.PainAssessmentDtos.AssessmentSummaryDto;
import com.bjjflow.backend.pain.PainAssessmentDtos.CreateAssessmentRequest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/users/me/pain/assessments")
@RequiredArgsConstructor
public class PainAssessmentController {

    private final PainAssessmentService service;

    private static Long userId(Authentication auth) {
        return Long.parseLong(auth.getName());
    }

    @PostMapping
    public AssessmentDto create(Authentication auth, @Valid @RequestBody CreateAssessmentRequest req) {
        return service.create(userId(auth), req);
    }

    @GetMapping
    public List<AssessmentSummaryDto> list(Authentication auth, @RequestParam(required = false) Integer limit) {
        return service.list(userId(auth), limit);
    }

    @GetMapping("/latest")
    public AssessmentDto latest(Authentication auth) {
        return service.latest(userId(auth));
    }

    @GetMapping("/{id}")
    public AssessmentDto get(Authentication auth, @PathVariable Long id) {
        return service.get(userId(auth), id);
    }

    @DeleteMapping("/{id}")
    public void delete(Authentication auth, @PathVariable Long id) {
        service.delete(userId(auth), id);
    }
}
