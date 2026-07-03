-- Indexes for the hottest read paths that were missing one (the rest of the
-- schema is already indexed). Additive only.

-- Global Comunidade feed: filter by visibility and page newest-first by id
-- (cursor pagination). Without this the feed full-scans check_ins.
CREATE INDEX idx_check_ins_feed ON check_ins (visibility, id);

-- The feed batch-loads each page's submissions via findByCheckInIdIn; there was
-- only a (user_id, direction, occurred_at) index, which can't serve this lookup.
CREATE INDEX idx_submission_logs_checkin ON submission_logs (check_in_id);

-- "My gym" lookup (gymMemberRepository.findFirstByUserId) runs on nearly every
-- gym request. UNIQUE(gym_id, user_id) can't serve a user_id-only query.
CREATE INDEX idx_gym_members_user ON gym_members (user_id);
