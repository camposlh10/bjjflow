-- Gym rule: when true, only instructors/owners can post to the Mural feed.
-- (graduation_target already exists from V4 — now editable by the owner.)
ALTER TABLE gyms ADD COLUMN instructors_only_posts BOOLEAN NOT NULL DEFAULT FALSE;
