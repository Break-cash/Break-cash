ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE users ADD COLUMN avatar_path TEXT;
ALTER TABLE users ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'unverified';
ALTER TABLE users ADD COLUMN phone_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN identity_submitted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN verification_ready_at TEXT;
ALTER TABLE users ADD COLUMN blue_badge INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN vip_level INTEGER NOT NULL DEFAULT 0;

UPDATE users
SET verification_status = CASE
  WHEN is_approved = 1 THEN 'verified'
  ELSE 'unverified'
END
WHERE verification_status IS NULL OR verification_status = '';

CREATE TABLE IF NOT EXISTS phone_verification_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS kyc_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  id_document_path TEXT NOT NULL,
  selfie_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewed_by INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);
