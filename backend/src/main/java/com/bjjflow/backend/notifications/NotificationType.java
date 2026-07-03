package com.bjjflow.backend.notifications;

/**
 * Notification categories (drive the categorized notification center + prefs).
 * SOCIAL = follows/likes/comments; MESSAGE = DMs; TRAINING = streaks/goals;
 * PERFORMANCE = data-driven insights ("AI coach"); COMPETITION; ACADEMY; SYSTEM.
 */
public enum NotificationType {
    SOCIAL,
    MESSAGE,
    TRAINING,
    PERFORMANCE,
    COMPETITION,
    ACADEMY,
    SYSTEM
}
