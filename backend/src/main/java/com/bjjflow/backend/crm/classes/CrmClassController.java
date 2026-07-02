package com.bjjflow.backend.crm.classes;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.crm.classes.CrmClassDtos.ClassResponse;
import com.bjjflow.backend.crm.classes.CrmClassDtos.CreateClassRequest;
import com.bjjflow.backend.crm.classes.CrmClassDtos.UpdateClassRequest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/crm/classes")
@RequiredArgsConstructor
public class CrmClassController {

    private final CrmClassService crmClassService;

    @GetMapping
    public List<ClassResponse> list(Authentication auth) {
        return crmClassService.list(Long.parseLong(auth.getName()));
    }

    @PostMapping
    public ClassResponse create(Authentication auth, @Valid @RequestBody CreateClassRequest request) {
        return crmClassService.create(Long.parseLong(auth.getName()), request);
    }

    @PutMapping("/{classId}")
    public ClassResponse update(Authentication auth, @PathVariable Long classId,
            @RequestBody UpdateClassRequest request) {
        return crmClassService.update(Long.parseLong(auth.getName()), classId, request);
    }

    @DeleteMapping("/{classId}")
    public void delete(Authentication auth, @PathVariable Long classId) {
        crmClassService.delete(Long.parseLong(auth.getName()), classId);
    }
}
