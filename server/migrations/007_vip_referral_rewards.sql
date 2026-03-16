-- VIP + referral rewards system

ALTER TABLE users ADD COLUMN IF NOT EXISTS total_deposit DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_owner INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
CREATE INDEX IF NOT EXISTS idx_users_total_deposit ON users(total_deposit);

ALTER TABLE vip_tiers ADD COLUMN IF NOT EXISTS referral_percent DOUBLE PRECISION NOT NULL DEFAULT 3;

CREATE TABLE IF NOT EXISTS referral_rewards (
  id SERIAL PRIMARY KEY,
  referrer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deposit_request_id INTEGER REFERENCES deposit_requests(id) ON DELETE SET NULL,
  source_amount DOUBLE PRECISION NOT NULL,
  reward_percent DOUBLE PRECISION NOT NULL,
  reward_amount DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON referral_rewards(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referred ON referral_rewards(referred_user_id);

-- Keep compatibility with existing invite linkage.
UPDATE users
SET referred_by = invited_by
WHERE referred_by IS NULL AND invited_by IS NOT NULL;

UPDATE users
SET is_owner = CASE WHEN role = 'owner' THEN 1 ELSE 0 END;

-- Backfill total_deposit from successful deposit-like balance transactions.
UPDATE users u
SET total_deposit = COALESCE(dep.total, 0)
FROM (
  SELECT user_id, SUM(amount) AS total
  FROM balance_transactions
  WHERE type IN ('deposit', 'add', 'bonus_add')
  GROUP BY user_id
) dep
WHERE dep.user_id = u.id;

INSERT INTO vip_tiers (
  level,
  title,
  min_deposit,
  min_trade_volume,
  referral_multiplier,
  referral_percent,
  perks_json,
  is_active
)
VALUES
  (1, 'VIP 1', 500, 0, 1, 4, '[]', 1),
  (2, 'VIP 2', 1500, 0, 1, 5, '[]', 1),
  (3, 'VIP 3', 3000, 0, 1, 6, '[]', 1),
  (4, 'VIP 4', 7000, 0, 1, 7, '[]', 1),
  (5, 'VIP 5', 15000, 0, 1, 8, '[]', 1)
ON CONFLICT(level) DO UPDATE SET
  title = excluded.title,
  min_deposit = excluded.min_deposit,
  referral_percent = excluded.referral_percent,
  is_active = 1;
