-- Personal video library: a color tag for organizing, and an optional uploaded
-- video (media_key) alongside the existing external video_url link.
ALTER TABLE personal_techniques ADD COLUMN color     VARCHAR(9);
ALTER TABLE personal_techniques ADD COLUMN media_key VARCHAR(300);
