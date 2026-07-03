-- Optional profile banner thumbnail; when null the app falls back to the
-- accent-color gradient.
ALTER TABLE users ADD COLUMN banner_key VARCHAR(255);
