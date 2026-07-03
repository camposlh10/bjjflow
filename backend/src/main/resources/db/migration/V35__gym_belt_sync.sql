-- A student controls whether a gym's graduation also updates their public profile
-- belt. When false, a gym promotion updates only that gym's local belt
-- (gym_members) and the promotion history, NOT the user's profile belt
-- (user_belt_progress). Default true preserves the previous behavior.
ALTER TABLE users ADD COLUMN gym_belt_sync BOOLEAN NOT NULL DEFAULT TRUE;

-- The belt a gym has assigned a member, tracked per gym and independent of the
-- member's profile belt. NULL = not assigned yet here → fall back to profile belt.
ALTER TABLE gym_members ADD COLUMN belt_rank_id BIGINT REFERENCES belt_ranks (id);
ALTER TABLE gym_members ADD COLUMN stripes      INT NOT NULL DEFAULT 0;
