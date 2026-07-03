package com.bjjflow.backend.submissions;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.submissions.SubmissionDtos.SubmissionStatsDto;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class SubmissionController {

    private final SubmissionService submissionService;

    @GetMapping("/{id}/submissions")
    public SubmissionStatsDto submissions(@PathVariable Long id,
            @RequestParam(required = false) String month,
            @RequestParam(required = false) String direction) {
        return submissionService.stats(id, month, direction);
    }
}
