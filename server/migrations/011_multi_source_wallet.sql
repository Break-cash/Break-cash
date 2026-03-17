-- Multi-source financial architecture
-- Extensible wallet, unified ledger, earning entries, mining subscriptions

-- 1. Earning source registry (extensibility)
CREATE TABLE IF NOT EXISTS earning_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  config_json TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_earning_sources_code ON earning_sources(code);
CREATE INDEX IF NOT EXISTS idx_earning_sources_active ON earning_sources(is_active);

-- 2. Wallet accounts (multi-account per user)
-- account_type: main | locked | withdrawable | pending
-- source_type: system | mining | tasks | referrals | deposits
CREATE TABLE IF NOT EXISTS wallet_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'USDT',
  account_type TEXT NOT NULL DEFAULT 'main',
  source_type TEXT NOT NULL DEFAULT 'system',
  balance_amount REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, currency, account_type, source_type)
);
CREATE INDEX IF NOT EXISTS idx_wallet_accounts_user ON wallet_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_accounts_user_currency ON wallet_accounts(user_id, currency);

-- 3. Unified ledger (every balance change recorded)
-- transaction_type: deposit | withdrawal | transfer | earning_credit | lock | unlock | adjust | fee
-- source_type: system | mining | tasks | referrals | deposits
-- reference_type: deposit_request | withdrawal_request | mining_subscription | task_redemption | referral_reward | earning_entry | admin_adjust
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'USDT',
  transaction_type TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'system',
  reference_type TEXT,
  reference_id INTEGER,
  amount REAL NOT NULL,
  fee_amount REAL NOT NULL DEFAULT 0,
  net_amount REAL NOT NULL,
  balance_before REAL,
  balance_after REAL,
  account_type_before TEXT,
  account_type_after TEXT,
  metadata TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_created ON wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference ON wallet_transactions(reference_type, reference_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_transactions_idempotency ON wallet_transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 4. Earning entries (earnings before transfer to main balance)
CREATE TABLE IF NOT EXISTS earning_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  reference_type TEXT NOT NULL,
  reference_id INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USDT',
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  transferred_at TEXT,
  transferred_wallet_txn_id INTEGER REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_type, reference_type, reference_id)
);
CREATE INDEX IF NOT EXISTS idx_earning_entries_user ON earning_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_earning_entries_status ON earning_entries(status);
CREATE INDEX IF NOT EXISTS idx_earning_entries_reference ON earning_entries(reference_type, reference_id);

-- 5. Mining subscriptions (lifecycle separate from generic wallet)
CREATE TABLE IF NOT EXISTS mining_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'USDT',
  status TEXT NOT NULL DEFAULT 'inactive',
  principal_amount REAL NOT NULL DEFAULT 0,
  daily_percent REAL NOT NULL DEFAULT 0,
  monthly_percent REAL NOT NULL DEFAULT 0,
  emergency_fee_percent REAL NOT NULL DEFAULT 0,
  started_at TEXT,
  ended_at TEXT,
  monthly_lock_until TEXT,
  last_daily_claim_at TEXT,
  daily_profit_claimed_total REAL NOT NULL DEFAULT 0,
  monthly_profit_accrued_total REAL NOT NULL DEFAULT 0,
  returned_principal REAL NOT NULL DEFAULT 0,
  penalty_amount REAL NOT NULL DEFAULT 0,
  closure_reason TEXT,
  cancel_requested_at TEXT,
  principal_release_at TEXT,
  principal_released_at TEXT,
  emergency_withdrawn_at TEXT,
  video_access_unlocked INTEGER NOT NULL DEFAULT 0,
  video_access_unlocked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_mining_subscriptions_status ON mining_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_mining_subscriptions_user ON mining_subscriptions(user_id);
