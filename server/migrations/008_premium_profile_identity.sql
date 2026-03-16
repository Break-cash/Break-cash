-- Premium profile identity fields (owner-controlled only).
-- Both columns are nullable by design; NULL means no premium identity assigned.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_color TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_badge TEXT;
