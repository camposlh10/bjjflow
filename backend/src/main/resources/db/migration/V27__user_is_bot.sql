-- Flags the seeded test bot so the app/feed/DM can recognise it (and so the
-- canned DM auto-reply only fires for it).
ALTER TABLE users ADD COLUMN is_bot BOOLEAN NOT NULL DEFAULT FALSE;
