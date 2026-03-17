-- Deposit-based referral system: referrals only count after first qualifying deposit

CREATE TABLE IF NOT EXISTS referrals (
  id SERIAL PRIMARY KEY,
  referrer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'reward_released')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  qualified_at TIMESTAMP,
  reward_released_at TIMESTAMP,
  qualifying_deposit_request_id INTEGER REFERENCES deposit_requests(id) ON DELETE SET NULL,
  first_deposit_amount DOUBLE PRECISION,
  reward_amount DOUBLE PRECISION,
  reward_percent DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

-- Add status to referral_rewards for reward_released tracking
ALTER TABLE referral_rewards ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'reward_released';
ALTER TABLE referral_rewards ADD COLUMN IF NOT EXISTS reward_released_at TIMESTAMP;
