-- Tasks reward codes + mining subscriptions

CREATE TABLE IF NOT EXISTS task_reward_codes (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  base_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
  tiers_json TEXT,
  max_reward_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_task_reward_codes_active ON task_reward_codes(is_active);

CREATE TABLE IF NOT EXISTS task_reward_redemptions (
  id SERIAL PRIMARY KEY,
  code_id INTEGER NOT NULL REFERENCES task_reward_codes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance_snapshot DOUBLE PRECISION NOT NULL DEFAULT 0,
  reward_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
  reward_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(code_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_task_reward_redemptions_user ON task_reward_redemptions(user_id);

CREATE TABLE IF NOT EXISTS mining_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'inactive',
  currency TEXT NOT NULL DEFAULT 'USDT',
  principal_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  daily_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
  monthly_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
  emergency_fee_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
  started_at TIMESTAMP,
  monthly_lock_until TIMESTAMP,
  last_daily_claim_at TIMESTAMP,
  daily_profit_claimed_total DOUBLE PRECISION NOT NULL DEFAULT 0,
  monthly_profit_accrued_total DOUBLE PRECISION NOT NULL DEFAULT 0,
  cancel_requested_at TIMESTAMP,
  principal_release_at TIMESTAMP,
  principal_released_at TIMESTAMP,
  emergency_withdrawn_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_mining_profiles_status ON mining_profiles(status);
