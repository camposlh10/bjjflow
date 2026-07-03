-- Training logs can be shared to the global Comunidade feed (PUBLIC) or kept to
-- oneself (PRIVATE). Quick one-tap check-ins default to PRIVATE; detailed
-- check-ins from the [+] sheet default to PUBLIC (set by the client). A logged
-- session may carry one photo of the training.
ALTER TABLE check_ins ADD COLUMN visibility VARCHAR(10) NOT NULL DEFAULT 'PRIVATE';
ALTER TABLE check_ins ADD COLUMN photo_key VARCHAR(255);
