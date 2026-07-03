package com.bjjflow.backend.email;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Fallback when no email provider is configured: logs the email so dev/test still works. */
public class LogEmailSender implements EmailSender {

    private static final Logger log = LoggerFactory.getLogger(LogEmailSender.class);

    @Override
    public void send(String to, String subject, String html) {
        log.info("[email:dev] to={} | subject={} | body={}", to, subject, html);
    }
}
