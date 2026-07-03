package com.bjjflow.backend.email;

/** Sends a transactional email. Implementations are selected in {@link EmailConfig}. */
public interface EmailSender {
    void send(String to, String subject, String html);
}
