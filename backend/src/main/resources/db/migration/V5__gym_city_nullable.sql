-- City is optional for user-created gyms (it was NOT NULL for the seeded rows).
ALTER TABLE gyms ALTER COLUMN city DROP NOT NULL;
