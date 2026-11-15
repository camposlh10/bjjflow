-- Phase 5 of the turnstile / face-scanner integration.

-- When the "bridge offline" alert went out; cleared when it is back.
ALTER TABLE access_bridges ADD COLUMN offline_alerted_at TIMESTAMP WITH TIME ZONE;

-- The member had an overdue invoice when they came in. Staff are alerted
-- once per member per day; the door is not blocked.
ALTER TABLE raw_access_events ADD COLUMN overdue BOOLEAN DEFAULT FALSE NOT NULL;

CREATE INDEX idx_raw_access_member_day ON raw_access_events (gym_id, student_user_id, event_time);
