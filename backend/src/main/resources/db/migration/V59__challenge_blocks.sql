-- A member who doesn't want challenges from someone: silenced for a while
-- (blocked_until set) or blocked until they lift it (blocked_until null).
CREATE TABLE challenge_blocks (
    user_id         BIGINT                   NOT NULL REFERENCES users (id),
    blocked_user_id BIGINT                   NOT NULL REFERENCES users (id),
    blocked_until   TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (user_id, blocked_user_id)
);
