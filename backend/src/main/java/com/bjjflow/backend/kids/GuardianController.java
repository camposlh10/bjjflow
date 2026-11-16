package com.bjjflow.backend.kids;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.kids.KidsDtos.ChildSummaryDto;
import com.bjjflow.backend.kids.KidsDtos.ClaimRequest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** For parents in the app: link to a child with the gym's code, and list linked children. */
@RestController
@RequestMapping("/api/v1/guardians/me")
@RequiredArgsConstructor
public class GuardianController {

    private final KidsFamilyService family;

    @PostMapping("/claim")
    public ChildSummaryDto claim(Authentication auth, @Valid @RequestBody ClaimRequest request) {
        return family.claim(Long.parseLong(auth.getName()), request.code());
    }

    @GetMapping("/children")
    public List<ChildSummaryDto> children(Authentication auth) {
        return family.myChildren(Long.parseLong(auth.getName()));
    }
}
