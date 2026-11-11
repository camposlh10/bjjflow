package com.bjjflow.backend.email;

import java.util.Map;

import org.springframework.stereotype.Component;

import com.bjjflow.backend.jobs.JobHandler;

import lombok.RequiredArgsConstructor;

/**
 * Sends one transactional email. Payload: to, subject, html. The payload is
 * erased from the jobs table once the job succeeds.
 */
@Component
@RequiredArgsConstructor
public class EmailJobHandler implements JobHandler {

    public static final String TYPE = "email.send";

    private final EmailSender emailSender;

    @Override
    public String type() {
        return TYPE;
    }

    @Override
    public void handle(Map<String, Object> payload) {
        emailSender.send(JobHandler.stringArg(payload, "to"), JobHandler.stringArg(payload, "subject"),
                JobHandler.stringArg(payload, "html"));
    }

    /** Waits on the email provider: no database transaction needed. */
    @Override
    public boolean transactional() {
        return false;
    }
}
