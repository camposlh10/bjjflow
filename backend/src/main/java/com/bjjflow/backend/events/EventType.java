package com.bjjflow.backend.events;

/** Event type constants shared by the events service and the feed/timeline DTOs. */
public final class EventType {

    public static final String FIRST_TRAINING = "FIRST_TRAINING";
    public static final String TRAINING_MILESTONE = "TRAINING_MILESTONE";
    public static final String STREAK_MILESTONE = "STREAK_MILESTONE";
    public static final String COMPETITION_RESULT = "COMPETITION_RESULT";
    // derived live from source tables (not stored), but used as DTO type tags:
    public static final String BELT_PROMOTION = "BELT_PROMOTION";
    public static final String ACADEMY_JOINED = "ACADEMY_JOINED";
    public static final String NEW_MEMBER = "NEW_MEMBER";

    private EventType() {
    }
}
