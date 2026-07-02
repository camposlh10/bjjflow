UPDATE raw_access_events
SET status = 'PROCESSED_ATTENDANCE'
WHERE status = 'CLASS_ATTENDANCE';

UPDATE raw_access_events
SET status = 'PROCESSED_GYM_VISIT'
WHERE status = 'GYM_VISIT';
