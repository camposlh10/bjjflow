-- Public @handle for each user. Stored lowercased so a plain unique index gives
-- case-insensitive uniqueness (portable across H2/Postgres). Existing users are
-- backfilled with user{id}; the app generates a friendly handle on register.
ALTER TABLE users ADD COLUMN username VARCHAR(30);
UPDATE users SET username = CONCAT('user', id) WHERE username IS NULL;
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX uq_users_username ON users (username);
