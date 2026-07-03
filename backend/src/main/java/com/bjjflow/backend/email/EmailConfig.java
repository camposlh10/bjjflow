package com.bjjflow.backend.email;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class EmailConfig {

    // Real delivery — only when a Resend key is present (env RESEND_API_KEY).
    @Bean
    @ConditionalOnProperty(name = "resend.api-key")
    EmailSender resendEmailSender(
            @Value("${resend.api-key}") String apiKey,
            @Value("${app.email.from:BJJ Flow <onboarding@resend.dev>}") String from) {
        return new ResendEmailSender(apiKey, from);
    }

    // Fallback: no key -> log the email (dev/test).
    @Bean
    @ConditionalOnMissingBean(EmailSender.class)
    EmailSender logEmailSender() {
        return new LogEmailSender();
    }
}
