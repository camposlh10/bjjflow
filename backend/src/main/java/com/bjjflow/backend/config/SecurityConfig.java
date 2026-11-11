package com.bjjflow.backend.config;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.bjjflow.backend.auth.JwtAuthFilter;

import lombok.RequiredArgsConstructor;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final AuthRateLimitFilter authRateLimitFilter;

    /**
     * Browser origins allowed to call the API (the CRM). Comma-separated; entries
     * may use wildcards, e.g. https://*.vercel.app. Native mobile apps do not use CORS.
     */
    @Value("${app.cors.allowed-origins:}")
    private List<String> allowedOrigins;

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // Stateless JWT API: no cookies involved, so CSRF protection does not apply
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/v1/health").permitAll()
                        // The realtime socket authenticates with the first frame it receives
                        // (browsers cannot send an Authorization header on a WebSocket).
                        .requestMatchers("/api/v1/realtime").permitAll()
                        // Liveness/readiness probes for the hosting platform.
                        .requestMatchers("/actuator/health/**").permitAll()
                        // The error dispatch must be reachable, else any unhandled exception
                        // surfaces as a misleading 401 instead of its real status.
                        .requestMatchers("/error").permitAll()
                        .requestMatchers("/api/v1/auth/**").permitAll()
                        .requestMatchers("/api/v1/belt-systems/**").permitAll()
                        // Access-control hardware authenticates with a device
                        // API key (X-Device-Key header), not a user JWT.
                        .requestMatchers("/api/v1/access/hardware/**").permitAll()
                        // POS/gateway webhooks authenticate with an integration
                        // key (X-Webhook-Key header), not a user JWT.
                        .requestMatchers("/api/v1/payments/webhooks/**").permitAll()
                        // Local media files (dev). Cloud storage uses signed URLs instead.
                        .requestMatchers("/media/**").permitAll()
                        .requestMatchers("/h2-console/**").permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(ex -> ex.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(authRateLimitFilter, JwtAuthFilter.class)
                // h2-console renders inside a frame
                .headers(headers -> headers.frameOptions(frame -> frame.sameOrigin()));
        return http.build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(allowedOrigins.stream().filter(origin -> !origin.isBlank()).toList());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
