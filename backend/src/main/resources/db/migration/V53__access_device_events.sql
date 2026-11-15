-- Phase 1 of the turnstile / face-scanner integration.

-- The device's own id for an event (Control iD log id, Hikvision serialNo...).
-- Devices resend events after a network drop; the same id never counts twice.
-- NULLs are distinct, so devices that send no id are unaffected.
ALTER TABLE raw_access_events ADD COLUMN device_event_id VARCHAR(100);
CREATE UNIQUE INDEX uq_raw_access_device_event ON raw_access_events (device_id, device_event_id);

-- ENTRY / EXIT when the device knows it (turnstiles do); NULL = unknown,
-- treated as an entry. Only entries mark attendance.
ALTER TABLE raw_access_events ADD COLUMN direction VARCHAR(10);

-- Where each attendance came from: APP (student checked in or reserved),
-- STAFF (marked in the CRM) or DEVICE (a scan at the gym), plus the scan
-- that produced it.
ALTER TABLE class_attendances ADD COLUMN source VARCHAR(10) DEFAULT 'APP' NOT NULL;
ALTER TABLE class_attendances ADD COLUMN access_event_id BIGINT REFERENCES raw_access_events (id);

-- Backfill: scans were the only writer that left marked_by_user_id empty.
UPDATE class_attendances
SET source = 'DEVICE'
WHERE marked_by_user_id IS NULL
  AND status IN ('PRESENT', 'LATE');

UPDATE class_attendances
SET source = 'STAFF'
WHERE marked_by_user_id IS NOT NULL
  AND marked_by_user_id <> user_id;
