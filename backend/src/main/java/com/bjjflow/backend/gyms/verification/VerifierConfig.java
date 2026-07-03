package com.bjjflow.backend.gyms.verification;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class VerifierConfig {

    // Real AI triage — only when an Anthropic key is present (env ANTHROPIC_API_KEY).
    @Bean
    @ConditionalOnProperty(name = "anthropic.api-key")
    CertificateVerifier claudeVerifier(
            @Value("${anthropic.api-key}") String apiKey,
            @Value("${anthropic.model:claude-sonnet-4-6}") String model) {
        return new ClaudeCertificateVerifier(apiKey, model);
    }

    // Fallback: no key -> everything goes to manual review.
    @Bean
    @ConditionalOnMissingBean(CertificateVerifier.class)
    CertificateVerifier stubVerifier() {
        return new StubCertificateVerifier();
    }
}
