package com.bjjflow.backend.users;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.auth.AuthDtos.UserDto;
import com.bjjflow.backend.auth.AuthService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final AuthService authService;

    @GetMapping("/me")
    public UserDto me(Authentication authentication) {
        return authService.me(Long.parseLong(authentication.getName()));
    }
}
