package com.bjjflow.backend.notifications;

import java.util.Map;

import org.springframework.stereotype.Component;

import com.bjjflow.backend.jobs.JobHandler;

import lombok.RequiredArgsConstructor;

/** Delivers one notification to a user's phones. Payload: userId, title, body. */
@Component
@RequiredArgsConstructor
public class PushJobHandler implements JobHandler {

    public static final String TYPE = "push.send";

    private final PushDispatcher pushDispatcher;

    @Override
    public String type() {
        return TYPE;
    }

    @Override
    public void handle(Map<String, Object> payload) {
        pushDispatcher.sendToUser(JobHandler.longArg(payload, "userId"),
                JobHandler.stringArg(payload, "title"), JobHandler.stringArg(payload, "body"));
    }

    /** Waits on Expo's API: no database transaction needed. */
    @Override
    public boolean transactional() {
        return false;
    }
}
