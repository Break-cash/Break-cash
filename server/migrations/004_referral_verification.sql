-- Track when a referral becomes "Active" (after verified first deposit)
-- A referral is counted as Active only after:
-- 1. User is marked as verified (verification_status = 'verified' OR is_approved = 1)
-- 2. User has made at least one real deposit (not bonus-only)

-- Adding helper column to track active referral status
ALTER TABLE users ADD COLUMN referral_verified_at TEXT;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_users_invited_by_verified ON users(invited_by, verification_status);
CREATE INDEX IF NOT EXISTS idx_users_invited_by_approved ON users(invited_by, is_approved);

-- Update any existing users who are already verified and have deposits
UPDATE users u
SET referral_verified_at = CURRENT_TIMESTAMP
WHERE invited_by IS NOT NULL
  AND (verification_status = 'verified' OR is_approved = 1)
  AND EXISTS (
    SELECT 1 FROM balance_transactions bt
    WHERE bt.user_id = u.id
      AND bt.type IN ('deposit')
    LIMIT 1
  )
  AND referral_verified_at IS NULL;
