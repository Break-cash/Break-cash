-- Principal lock / conditional withdrawal

CREATE TABLE IF NOT EXISTS user_principal_locks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'USDT',
  principal_amount DOUBLE PRECISION NOT NULL,
  required_profit_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  unlock_ratio DOUBLE PRECISION NOT NULL DEFAULT 1,
  source_type TEXT NOT NULL DEFAULT 'deposit_request',
  source_id INTEGER,
  lock_status TEXT NOT NULL DEFAULT 'locked',
  unlocked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_principal_locks_user_currency
  ON user_principal_locks(user_id, currency, lock_status);

CREATE TABLE IF NOT EXISTS user_unlock_overrides (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  force_unlock_principal INTEGER NOT NULL DEFAULT 0,
  custom_unlock_ratio DOUBLE PRECISION,
  custom_min_profit DOUBLE PRECISION,
  note TEXT,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
