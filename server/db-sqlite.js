/**
 * SQLite adapter for local development when PostgreSQL is unavailable.
 * Enable with: USE_SQLITE=1
 */
import sqlite3 from 'sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function createDb() {
  return new Promise((resolve, reject) => {
    const dbPath = path.join(__dirname, 'db.sqlite')
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) reject(err)
      else resolve(db)
    })
  })
}

function runAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err)
      else resolve({ lastID: this.lastID, changes: this.changes })
    })
  })
}

function allAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err)
      else resolve(rows || [])
    })
  })
}

/** Wrapper that mimics pg Pool interface: db.query(sql, params) -> { rows, rowCount } */
function createPgLikeWrapper(db) {
  return {
    query: async (sql, params = []) => {
      const sqliteSql = toSqliteSql(sql)
      const upper = sqliteSql.trim().toUpperCase()
      const isSelect = upper.startsWith('SELECT') || upper.startsWith('WITH')
      if (isSelect) {
        const rows = await allAsync(db, sqliteSql, params)
        return { rows, rowCount: rows.length }
      }
      const { lastID, changes } = await runAsync(db, sqliteSql, params)
      if (sql.toUpperCase().includes('RETURNING')) {
        const returningMatch = sql.match(/RETURNING\s+(\w+)/i)
        const col = returningMatch ? returningMatch[1] : 'id'
        const rows = lastID ? [{ [col]: lastID }] : []
        return { rows, rowCount: changes }
      }
      return { rows: lastID ? [{ id: lastID }] : [], rowCount: changes }
    },
  }
}

function toSqliteSql(sql) {
  let s = sql.replace(/\$(\d+)/g, '?')
  s = s.replace(/CURRENT_TIMESTAMP/g, "datetime('now')")
  s = s.replace(/\(CURRENT_TIMESTAMP\s+\+\s+INTERVAL\s+'(\d+)\s+minutes'\)/gi, "datetime('now', '+$1 minutes')")
  return s
}

const RESERVED_ID_FLOOR = 3000

async function reserveFirst3000IdsSqlite(db) {
  const tables = await allAsync(
    db,
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
  )
  for (const row of tables) {
    const tableName = String(row?.name || '')
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) continue
    const cols = await allAsync(db, `PRAGMA table_info("${tableName}")`)
    const hasIdPrimary = cols.some(
      (col) =>
        String(col?.name || '').toLowerCase() === 'id' &&
        Number(col?.pk || 0) === 1 &&
        String(col?.type || '').toUpperCase().includes('INT'),
    )
    if (!hasIdPrimary) continue
    const maxRows = await allAsync(db, `SELECT COALESCE(MAX(id), 0) AS max_id FROM "${tableName}"`)
    const currentMax = Number(maxRows?.[0]?.max_id || 0)
    const targetValue = Math.max(RESERVED_ID_FLOOR, currentMax)
    const seqRow = await allAsync(db, `SELECT seq FROM sqlite_sequence WHERE name = ?`, [tableName])
    const currentSeq = Number(seqRow?.[0]?.seq || 0)
    const newSeq = Math.max(targetValue, currentSeq)
    await runAsync(db, `DELETE FROM sqlite_sequence WHERE name = ?`, [tableName])
    await runAsync(db, `INSERT INTO sqlite_sequence(name, seq) VALUES(?, ?)`, [tableName, newSeq])
  }
}

const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  is_approved INTEGER NOT NULL DEFAULT 0,
  is_banned INTEGER NOT NULL DEFAULT 0,
  is_frozen INTEGER NOT NULL DEFAULT 0,
  banned_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  display_name TEXT,
  bio TEXT,
  avatar_path TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  phone_verified INTEGER NOT NULL DEFAULT 0,
  identity_submitted INTEGER NOT NULL DEFAULT 0,
  verification_ready_at TEXT,
  blue_badge INTEGER NOT NULL DEFAULT 0,
  vip_level INTEGER NOT NULL DEFAULT 0,
  profile_color TEXT,
  profile_badge TEXT,
  country TEXT,
  preferred_language TEXT,
  preferred_currency TEXT,
  referral_code TEXT UNIQUE,
  invited_by INTEGER REFERENCES users(id),
  referred_by INTEGER REFERENCES users(id),
  total_deposit REAL NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  is_owner INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT,
  last_ip TEXT,
  last_user_agent TEXT,
  two_factor_enabled INTEGER NOT NULL DEFAULT 0,
  two_factor_for_admin_actions INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  created_by INTEGER REFERENCES users(id),
  used_by INTEGER REFERENCES users(id),
  used_at TEXT,
  expires_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS watchlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  symbol TEXT NOT NULL,
  market_type TEXT NOT NULL DEFAULT 'crypto',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, symbol)
);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id);

CREATE TABLE IF NOT EXISTS portfolio_holdings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  symbol TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  avg_price REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, symbol)
);
CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_user_id ON portfolio_holdings(user_id);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  quantity REAL NOT NULL,
  price REAL NOT NULL,
  fee REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'filled',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);

CREATE TABLE IF NOT EXISTS balances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  currency TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, currency)
);

CREATE TABLE IF NOT EXISTS balance_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  admin_id INTEGER REFERENCES users(id),
  type TEXT NOT NULL,
  currency TEXT NOT NULL,
  amount REAL NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_balance_transactions_user_id ON balance_transactions(user_id);

CREATE TABLE IF NOT EXISTS deposit_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USDT',
  method TEXT NOT NULL,
  transfer_ref TEXT NOT NULL,
  user_notes TEXT,
  proof_image_path TEXT,
  request_status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TEXT,
  completed_at TEXT,
  processed_txn_id INTEGER REFERENCES balance_transactions(id),
  idempotency_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_user_id ON deposit_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_status ON deposit_requests(request_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deposit_requests_idempotency
  ON deposit_requests(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USDT',
  method TEXT NOT NULL,
  account_info TEXT NOT NULL,
  user_notes TEXT,
  request_status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TEXT,
  completed_at TEXT,
  processed_txn_id INTEGER REFERENCES balance_transactions(id),
  idempotency_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(request_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawal_requests_idempotency
  ON withdrawal_requests(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_principal_locks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  currency TEXT NOT NULL DEFAULT 'USDT',
  principal_amount REAL NOT NULL,
  required_profit_amount REAL NOT NULL DEFAULT 0,
  unlock_ratio REAL NOT NULL DEFAULT 1,
  source_type TEXT NOT NULL DEFAULT 'deposit_request',
  source_id INTEGER,
  lock_status TEXT NOT NULL DEFAULT 'locked',
  unlocked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_user_principal_locks_user_currency
  ON user_principal_locks(user_id, currency, lock_status);

CREATE TABLE IF NOT EXISTS user_unlock_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  force_unlock_principal INTEGER NOT NULL DEFAULT 0,
  custom_unlock_ratio REAL,
  custom_min_profit REAL,
  note TEXT,
  updated_by INTEGER REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  permission TEXT NOT NULL,
  granted_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, permission)
);

CREATE TABLE IF NOT EXISTS task_reward_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  base_percent REAL NOT NULL DEFAULT 0,
  tiers_json TEXT,
  max_reward_amount REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_task_reward_codes_active ON task_reward_codes(is_active);

CREATE TABLE IF NOT EXISTS task_reward_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code_id INTEGER NOT NULL REFERENCES task_reward_codes(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  balance_snapshot REAL NOT NULL DEFAULT 0,
  reward_percent REAL NOT NULL DEFAULT 0,
  reward_amount REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(code_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_task_reward_redemptions_user ON task_reward_redemptions(user_id);

CREATE TABLE IF NOT EXISTS strategy_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  expert_name TEXT,
  feature_type TEXT NOT NULL DEFAULT 'trial_trade',
  reward_mode TEXT NOT NULL DEFAULT 'percent',
  reward_value REAL NOT NULL DEFAULT 0,
  asset_symbol TEXT NOT NULL DEFAULT 'BTCUSDT',
  trade_return_percent REAL NOT NULL DEFAULT 0,
  expires_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_strategy_codes_active ON strategy_codes(is_active);

CREATE TABLE IF NOT EXISTS strategy_code_usages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code_id INTEGER NOT NULL REFERENCES strategy_codes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending_confirmation',
  selected_symbol TEXT,
  feature_type TEXT NOT NULL DEFAULT 'trial_trade',
  balance_snapshot REAL NOT NULL DEFAULT 0,
  stake_amount REAL NOT NULL DEFAULT 0,
  reward_value REAL NOT NULL DEFAULT 0,
  trade_return_percent REAL NOT NULL DEFAULT 0,
  entry_price REAL,
  exit_price REAL,
  wallet_debit_txn_id INTEGER REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  wallet_credit_txn_id INTEGER REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  metadata_json TEXT,
  confirmed_at TEXT,
  settled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(code_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_strategy_code_usages_user ON strategy_code_usages(user_id);
CREATE INDEX IF NOT EXISTS idx_strategy_code_usages_status ON strategy_code_usages(status);

CREATE TABLE IF NOT EXISTS mining_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'inactive',
  currency TEXT NOT NULL DEFAULT 'USDT',
  video_access_unlocked INTEGER NOT NULL DEFAULT 0,
  video_access_unlocked_at TEXT,
  principal_amount REAL NOT NULL DEFAULT 0,
  daily_percent REAL NOT NULL DEFAULT 0,
  monthly_percent REAL NOT NULL DEFAULT 0,
  emergency_fee_percent REAL NOT NULL DEFAULT 0,
  started_at TEXT,
  monthly_lock_until TEXT,
  last_daily_claim_at TEXT,
  daily_profit_claimed_total REAL NOT NULL DEFAULT 0,
  monthly_profit_accrued_total REAL NOT NULL DEFAULT 0,
  cancel_requested_at TEXT,
  principal_release_at TEXT,
  principal_released_at TEXT,
  emergency_withdrawn_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mining_profiles_status ON mining_profiles(status);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS user_push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  endpoint TEXT NOT NULL UNIQUE,
  subscription_json TEXT NOT NULL,
  user_agent TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_success_at TEXT,
  last_failure_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_user_push_subscriptions_user ON user_push_subscriptions(user_id, is_active);

CREATE TABLE IF NOT EXISTS phone_verification_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_phone_verification_codes_expires ON phone_verification_codes(expires_at);

CREATE TABLE IF NOT EXISTS password_reset_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  identifier TEXT NOT NULL,
  channel TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_user ON password_reset_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_expires ON password_reset_codes(expires_at);

CREATE TABLE IF NOT EXISTS user_recovery_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  recovery_code TEXT NOT NULL UNIQUE,
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  acknowledged_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_user_recovery_codes_user ON user_recovery_codes(user_id);

CREATE TABLE IF NOT EXISTS recovery_code_review_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  recovery_code TEXT NOT NULL,
  request_status TEXT NOT NULL DEFAULT 'pending',
  request_note TEXT,
  submitted_ip TEXT,
  submitted_user_agent TEXT,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_recovery_requests_user_status
  ON recovery_code_review_requests(user_id, request_status, created_at DESC);

CREATE TABLE IF NOT EXISTS kyc_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  id_document_path TEXT NOT NULL,
  selfie_path TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  full_name_match_score REAL,
  face_match_score REAL,
  aml_risk_level TEXT NOT NULL DEFAULT 'low',
  auto_review_at TEXT,
  reviewed_note TEXT,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_review_status ON kyc_submissions(review_status);
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_user_id ON kyc_submissions(user_id);

CREATE TABLE IF NOT EXISTS friend_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_user_id INTEGER NOT NULL REFERENCES users(id),
  to_user_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(from_user_id, to_user_id)
);
CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON friend_requests(to_user_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_from ON friend_requests(from_user_id);

CREATE TABLE IF NOT EXISTS user_admin_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  admin_id INTEGER REFERENCES users(id),
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_user_admin_notes_user_id ON user_admin_notes(user_id);

CREATE TABLE IF NOT EXISTS user_activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON user_activity_logs(user_id);

CREATE TABLE IF NOT EXISTS daily_trade_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  symbol TEXT,
  side TEXT,
  entry_price REAL,
  take_profit REAL,
  stop_loss REAL,
  success_rate REAL DEFAULT 0,
  visibility_scope TEXT NOT NULL DEFAULT 'all',
  min_vip_level INTEGER NOT NULL DEFAULT 0,
  is_visible INTEGER NOT NULL DEFAULT 1,
  starts_at TEXT,
  ends_at TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bonus_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_type TEXT NOT NULL,
  title TEXT NOT NULL,
  conditions_json TEXT,
  reward_json TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  starts_at TEXT,
  ends_at TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vip_tiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  min_deposit REAL NOT NULL DEFAULT 0,
  min_trade_volume REAL NOT NULL DEFAULT 0,
  referral_multiplier REAL NOT NULL DEFAULT 1,
  referral_percent REAL NOT NULL DEFAULT 3,
  perks_json TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS referral_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_user_id INTEGER NOT NULL REFERENCES users(id),
  referred_user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  deposit_request_id INTEGER REFERENCES deposit_requests(id),
  source_amount REAL NOT NULL,
  reward_percent REAL NOT NULL,
  reward_amount REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON referral_rewards(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referred ON referral_rewards(referred_user_id);

CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_user_id INTEGER NOT NULL REFERENCES users(id),
  referred_user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'reward_released')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  qualified_at TEXT,
  reward_released_at TEXT,
  qualifying_deposit_request_id INTEGER REFERENCES deposit_requests(id),
  first_deposit_amount REAL,
  reward_amount REAL,
  reward_percent REAL
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

CREATE TABLE IF NOT EXISTS partner_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  commission_rate REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_reward_mode_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  payout_mode TEXT NOT NULL DEFAULT 'withdrawable',
  note TEXT,
  updated_by INTEGER REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_user_reward_mode_overrides_user ON user_reward_mode_overrides(user_id);

CREATE TABLE IF NOT EXISTS user_reward_payout_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  source_type TEXT NOT NULL DEFAULT 'all',
  payout_mode TEXT NOT NULL DEFAULT 'withdrawable',
  lock_hours INTEGER,
  note TEXT,
  updated_by INTEGER REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, source_type)
);
CREATE INDEX IF NOT EXISTS idx_user_reward_payout_overrides_user ON user_reward_payout_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_user_reward_payout_overrides_source ON user_reward_payout_overrides(source_type);

CREATE TABLE IF NOT EXISTS content_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  target_filters_json TEXT,
  schedule_at TEXT,
  expires_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  session_id TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, is_active);

CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT,
  user_id INTEGER REFERENCES users(id),
  ip_address TEXT,
  user_agent TEXT,
  success INTEGER NOT NULL DEFAULT 0,
  failure_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_created ON login_attempts(ip_address, created_at);

CREATE TABLE IF NOT EXISTS security_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  ip_address TEXT,
  user_agent TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_security_alerts_user_created ON security_alerts(user_id, created_at);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER NOT NULL REFERENCES users(id),
  target_user_id INTEGER REFERENCES users(id),
  section TEXT NOT NULL,
  action TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor_created ON admin_audit_logs(actor_user_id, created_at);

CREATE TABLE IF NOT EXISTS admin_staff_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  admin_role TEXT NOT NULL DEFAULT 'admin',
  is_active INTEGER NOT NULL DEFAULT 1,
  can_view_sensitive INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kyc_watchlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  note TEXT NOT NULL,
  source TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('image', 'video')),
  media_url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  link_url TEXT,
  placement TEXT NOT NULL DEFAULT 'all',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ads_placement ON ads(placement);
CREATE INDEX IF NOT EXISTS idx_ads_is_active ON ads(is_active);

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

CREATE TABLE IF NOT EXISTS wallet_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
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

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
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
  created_by INTEGER REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_created ON wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference ON wallet_transactions(reference_type, reference_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_transactions_idempotency ON wallet_transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS earning_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  source_type TEXT NOT NULL,
  reference_type TEXT NOT NULL,
  reference_id INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USDT',
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payout_mode TEXT NOT NULL DEFAULT 'withdrawable',
  locked_until TEXT,
  transferred_at TEXT,
  transferred_wallet_txn_id INTEGER REFERENCES wallet_transactions(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_type, reference_type, reference_id)
);
CREATE INDEX IF NOT EXISTS idx_earning_entries_user ON earning_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_earning_entries_status ON earning_entries(status);
CREATE INDEX IF NOT EXISTS idx_earning_entries_reference ON earning_entries(reference_type, reference_id);

CREATE TABLE IF NOT EXISTS mining_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
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
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mining_subscriptions_status ON mining_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_mining_subscriptions_user ON mining_subscriptions(user_id);
`

async function ensureSchema(db) {
  const statements = SQLITE_SCHEMA.split(';').filter((s) => s.trim())
  for (const stmt of statements) {
    const s = stmt.trim()
    if (!s) continue
    try {
      await runAsync(db, s)
    } catch (error) {
      // Legacy DBs may miss review_status until migration below runs.
      const msg = String(error?.message || '')
      const isKycReviewStatusIndex =
        s.includes('idx_kyc_submissions_review_status') &&
        msg.toLowerCase().includes('no such column: review_status')
      if (!isKycReviewStatusIndex) throw error
    }
  }
  const usersCols = await allAsync(db, `PRAGMA table_info(users)`)
  const ensureCol = async (name, sql) => {
    if (!usersCols.some((row) => String(row.name) === name)) {
      await runAsync(db, sql)
    }
  }
  await ensureCol('is_frozen', `ALTER TABLE users ADD COLUMN is_frozen INTEGER NOT NULL DEFAULT 0`)
  await ensureCol('banned_until', `ALTER TABLE users ADD COLUMN banned_until TEXT`)
  await ensureCol('country', `ALTER TABLE users ADD COLUMN country TEXT`)
  await ensureCol('preferred_language', `ALTER TABLE users ADD COLUMN preferred_language TEXT`)
  await ensureCol('preferred_currency', `ALTER TABLE users ADD COLUMN preferred_currency TEXT`)
  await ensureCol('referral_code', `ALTER TABLE users ADD COLUMN referral_code TEXT`)
  await ensureCol('invited_by', `ALTER TABLE users ADD COLUMN invited_by INTEGER`)
  await ensureCol('referred_by', `ALTER TABLE users ADD COLUMN referred_by INTEGER`)
  await ensureCol('total_deposit', `ALTER TABLE users ADD COLUMN total_deposit REAL NOT NULL DEFAULT 0`)
  await ensureCol('points', `ALTER TABLE users ADD COLUMN points INTEGER NOT NULL DEFAULT 0`)
  await ensureCol('is_owner', `ALTER TABLE users ADD COLUMN is_owner INTEGER NOT NULL DEFAULT 0`)
  await ensureCol('last_login_at', `ALTER TABLE users ADD COLUMN last_login_at TEXT`)
  await ensureCol('last_ip', `ALTER TABLE users ADD COLUMN last_ip TEXT`)
  await ensureCol('last_user_agent', `ALTER TABLE users ADD COLUMN last_user_agent TEXT`)
  await ensureCol('bio', `ALTER TABLE users ADD COLUMN bio TEXT`)
  await ensureCol('profile_color', `ALTER TABLE users ADD COLUMN profile_color TEXT`)
  await ensureCol('profile_badge', `ALTER TABLE users ADD COLUMN profile_badge TEXT`)
  await ensureCol('two_factor_enabled', `ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER NOT NULL DEFAULT 0`)
  await ensureCol('two_factor_for_admin_actions', `ALTER TABLE users ADD COLUMN two_factor_for_admin_actions INTEGER NOT NULL DEFAULT 0`)
  const kycCols = await allAsync(db, `PRAGMA table_info(kyc_submissions)`)
  const ensureKycCol = async (name, sql) => {
    if (!kycCols.some((row) => String(row.name) === name)) {
      await runAsync(db, sql)
    }
  }
  await ensureKycCol('review_status', `ALTER TABLE kyc_submissions ADD COLUMN review_status TEXT NOT NULL DEFAULT 'pending'`)
  await ensureKycCol('rejection_reason', `ALTER TABLE kyc_submissions ADD COLUMN rejection_reason TEXT`)
  await ensureKycCol('full_name_match_score', `ALTER TABLE kyc_submissions ADD COLUMN full_name_match_score REAL`)
  await ensureKycCol('face_match_score', `ALTER TABLE kyc_submissions ADD COLUMN face_match_score REAL`)
  await ensureKycCol('aml_risk_level', `ALTER TABLE kyc_submissions ADD COLUMN aml_risk_level TEXT NOT NULL DEFAULT 'low'`)
  await ensureKycCol('auto_review_at', `ALTER TABLE kyc_submissions ADD COLUMN auto_review_at TEXT`)
  await ensureKycCol('reviewed_note', `ALTER TABLE kyc_submissions ADD COLUMN reviewed_note TEXT`)
  const vipTierCols = await allAsync(db, `PRAGMA table_info(vip_tiers)`)
  if (!vipTierCols.some((row) => String(row.name) === 'referral_percent')) {
    await runAsync(db, `ALTER TABLE vip_tiers ADD COLUMN referral_percent REAL NOT NULL DEFAULT 3`)
  }
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_kyc_submissions_review_status ON kyc_submissions(review_status)`)
  await runAsync(
    db,
    `CREATE TABLE IF NOT EXISTS user_reward_mode_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
      payout_mode TEXT NOT NULL DEFAULT 'withdrawable',
      note TEXT,
      updated_by INTEGER REFERENCES users(id),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  )
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_user_reward_mode_overrides_user ON user_reward_mode_overrides(user_id)`)
  await runAsync(
    db,
    `CREATE TABLE IF NOT EXISTS user_reward_payout_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      source_type TEXT NOT NULL DEFAULT 'all',
      payout_mode TEXT NOT NULL DEFAULT 'withdrawable',
      lock_hours INTEGER,
      note TEXT,
      updated_by INTEGER REFERENCES users(id),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, source_type)
    )`,
  )
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_user_reward_payout_overrides_user ON user_reward_payout_overrides(user_id)`)
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_user_reward_payout_overrides_source ON user_reward_payout_overrides(source_type)`)
  await runAsync(db, `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code)`)
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by)`)
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_users_total_deposit ON users(total_deposit)`)
  await runAsync(db, `UPDATE users SET referred_by = invited_by WHERE referred_by IS NULL AND invited_by IS NOT NULL`)
  await runAsync(db, `UPDATE users SET is_owner = CASE WHEN role = 'owner' THEN 1 ELSE 0 END`)
  const depositCols = await allAsync(db, `PRAGMA table_info(deposit_requests)`)
  const ensureDepositCol = async (name, sql) => {
    if (!depositCols.some((row) => String(row.name) === name)) {
      await runAsync(db, sql)
    }
  }
  await ensureDepositCol('proof_image_path', `ALTER TABLE deposit_requests ADD COLUMN proof_image_path TEXT`)
  await ensureDepositCol('request_status', `ALTER TABLE deposit_requests ADD COLUMN request_status TEXT NOT NULL DEFAULT 'pending'`)
  await ensureDepositCol('admin_note', `ALTER TABLE deposit_requests ADD COLUMN admin_note TEXT`)
  await ensureDepositCol('reviewed_by', `ALTER TABLE deposit_requests ADD COLUMN reviewed_by INTEGER`)
  await ensureDepositCol('reviewed_at', `ALTER TABLE deposit_requests ADD COLUMN reviewed_at TEXT`)
  await ensureDepositCol('completed_at', `ALTER TABLE deposit_requests ADD COLUMN completed_at TEXT`)
  await ensureDepositCol('wallet_transaction_id', `ALTER TABLE deposit_requests ADD COLUMN wallet_transaction_id INTEGER REFERENCES wallet_transactions(id)`)
  try {
    await runAsync(db, `ALTER TABLE deposit_requests DROP COLUMN processed_txn_id`)
  } catch (_) {}
  await ensureDepositCol('idempotency_key', `ALTER TABLE deposit_requests ADD COLUMN idempotency_key TEXT`)
  await ensureDepositCol('updated_at', `ALTER TABLE deposit_requests ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'))`)
  const withdrawalCols = await allAsync(db, `PRAGMA table_info(withdrawal_requests)`)
  const ensureWithdrawalCol = async (name, sql) => {
    if (!withdrawalCols.some((row) => String(row.name) === name)) {
      await runAsync(db, sql)
    }
  }
  await ensureWithdrawalCol('request_status', `ALTER TABLE withdrawal_requests ADD COLUMN request_status TEXT NOT NULL DEFAULT 'pending'`)
  await ensureWithdrawalCol('admin_note', `ALTER TABLE withdrawal_requests ADD COLUMN admin_note TEXT`)
  await ensureWithdrawalCol('reviewed_by', `ALTER TABLE withdrawal_requests ADD COLUMN reviewed_by INTEGER`)
  await ensureWithdrawalCol('reviewed_at', `ALTER TABLE withdrawal_requests ADD COLUMN reviewed_at TEXT`)
  await ensureWithdrawalCol('completed_at', `ALTER TABLE withdrawal_requests ADD COLUMN completed_at TEXT`)
  await ensureWithdrawalCol('wallet_transaction_id', `ALTER TABLE withdrawal_requests ADD COLUMN wallet_transaction_id INTEGER REFERENCES wallet_transactions(id)`)
  try {
    await runAsync(db, `ALTER TABLE withdrawal_requests DROP COLUMN processed_txn_id`)
  } catch (_) {}
  await ensureWithdrawalCol('idempotency_key', `ALTER TABLE withdrawal_requests ADD COLUMN idempotency_key TEXT`)
  await ensureWithdrawalCol('updated_at', `ALTER TABLE withdrawal_requests ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'))`)
  const miningCols = await allAsync(db, `PRAGMA table_info(mining_profiles)`)
  const ensureMiningCol = async (name, sql) => {
    if (!miningCols.some((row) => String(row.name) === name)) {
      await runAsync(db, sql)
    }
  }
  await ensureMiningCol('video_access_unlocked', `ALTER TABLE mining_profiles ADD COLUMN video_access_unlocked INTEGER NOT NULL DEFAULT 0`)
  await ensureMiningCol('video_access_unlocked_at', `ALTER TABLE mining_profiles ADD COLUMN video_access_unlocked_at TEXT`)
  const strategyCodeCols = await allAsync(db, `PRAGMA table_info(strategy_codes)`)
  const ensureStrategyCodeCol = async (name, sql) => {
    if (!strategyCodeCols.some((row) => String(row.name) === name)) {
      await runAsync(db, sql)
    }
  }
  await ensureStrategyCodeCol('expert_name', `ALTER TABLE strategy_codes ADD COLUMN expert_name TEXT`)
  const lockCols = await allAsync(db, `PRAGMA table_info(user_principal_locks)`)
  const ensureLockCol = async (name, sql) => {
    if (!lockCols.some((row) => String(row.name) === name)) {
      await runAsync(db, sql)
    }
  }
  await ensureLockCol('required_profit_amount', `ALTER TABLE user_principal_locks ADD COLUMN required_profit_amount REAL NOT NULL DEFAULT 0`)
  await ensureLockCol('unlock_ratio', `ALTER TABLE user_principal_locks ADD COLUMN unlock_ratio REAL NOT NULL DEFAULT 1`)
  await ensureLockCol('source_type', `ALTER TABLE user_principal_locks ADD COLUMN source_type TEXT NOT NULL DEFAULT 'deposit_request'`)
  await ensureLockCol('source_id', `ALTER TABLE user_principal_locks ADD COLUMN source_id INTEGER`)
  await ensureLockCol('lock_status', `ALTER TABLE user_principal_locks ADD COLUMN lock_status TEXT NOT NULL DEFAULT 'locked'`)
  await ensureLockCol('unlocked_at', `ALTER TABLE user_principal_locks ADD COLUMN unlocked_at TEXT`)
  await ensureLockCol('updated_at', `ALTER TABLE user_principal_locks ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'))`)
  const rewardPayoutOverrideCols = await allAsync(db, `PRAGMA table_info(user_reward_payout_overrides)`)
  const ensureRewardPayoutOverrideCol = async (name, sql) => {
    if (!rewardPayoutOverrideCols.some((row) => String(row.name) === name)) {
      await runAsync(db, sql)
    }
  }
  await ensureRewardPayoutOverrideCol('lock_hours', `ALTER TABLE user_reward_payout_overrides ADD COLUMN lock_hours INTEGER`)
  const earningEntryCols = await allAsync(db, `PRAGMA table_info(earning_entries)`)
  const ensureEarningEntryCol = async (name, sql) => {
    if (!earningEntryCols.some((row) => String(row.name) === name)) {
      await runAsync(db, sql)
    }
  }
  await ensureEarningEntryCol('payout_mode', `ALTER TABLE earning_entries ADD COLUMN payout_mode TEXT NOT NULL DEFAULT 'withdrawable'`)
  await ensureEarningEntryCol('locked_until', `ALTER TABLE earning_entries ADD COLUMN locked_until TEXT`)
  const overrideCols = await allAsync(db, `PRAGMA table_info(user_unlock_overrides)`)
  const ensureOverrideCol = async (name, sql) => {
    if (!overrideCols.some((row) => String(row.name) === name)) {
      await runAsync(db, sql)
    }
  }
  await ensureOverrideCol('force_unlock_principal', `ALTER TABLE user_unlock_overrides ADD COLUMN force_unlock_principal INTEGER NOT NULL DEFAULT 0`)
  await ensureOverrideCol('custom_unlock_ratio', `ALTER TABLE user_unlock_overrides ADD COLUMN custom_unlock_ratio REAL`)
  await ensureOverrideCol('custom_min_profit', `ALTER TABLE user_unlock_overrides ADD COLUMN custom_min_profit REAL`)
  await ensureOverrideCol('note', `ALTER TABLE user_unlock_overrides ADD COLUMN note TEXT`)
  await ensureOverrideCol('updated_by', `ALTER TABLE user_unlock_overrides ADD COLUMN updated_by INTEGER`)
  await ensureOverrideCol('updated_at', `ALTER TABLE user_unlock_overrides ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'))`)
  await runAsync(
    db,
    `CREATE TABLE IF NOT EXISTS user_push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      endpoint TEXT NOT NULL UNIQUE,
      subscription_json TEXT NOT NULL,
      user_agent TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      failure_count INTEGER NOT NULL DEFAULT 0,
      last_success_at TEXT,
      last_failure_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  )
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_user_push_subscriptions_user ON user_push_subscriptions(user_id, is_active)`)
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_deposit_requests_user_id ON deposit_requests(user_id)`)
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_deposit_requests_status ON deposit_requests(request_status)`)
  await runAsync(db, `CREATE UNIQUE INDEX IF NOT EXISTS idx_deposit_requests_idempotency ON deposit_requests(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL`)
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON withdrawal_requests(user_id)`)
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(request_status)`)
  await runAsync(db, `CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawal_requests_idempotency ON withdrawal_requests(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL`)
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_earning_entries_locked_until ON earning_entries(locked_until)`)
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_user_principal_locks_user_currency ON user_principal_locks(user_id, currency, lock_status)`)
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON referral_rewards(referrer_user_id)`)
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_referral_rewards_referred ON referral_rewards(referred_user_id)`)
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id)`).catch(() => {})
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_user_id)`).catch(() => {})
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status)`).catch(() => {})
  try {
    await runAsync(db, `
      INSERT OR IGNORE INTO referrals (referrer_user_id, referred_user_id, status, qualified_at, reward_released_at, qualifying_deposit_request_id, first_deposit_amount, reward_amount, reward_percent)
      SELECT u.referred_by, u.id, CASE WHEN rr.id IS NOT NULL THEN 'reward_released' ELSE 'pending' END,
             rr.created_at, rr.created_at, rr.deposit_request_id, rr.source_amount, rr.reward_amount, rr.reward_percent
      FROM users u
      LEFT JOIN referral_rewards rr ON rr.referred_user_id = u.id
      WHERE u.referred_by IS NOT NULL AND u.referred_by <> u.id
    `)
  } catch (_) {}
  await runAsync(db, `UPDATE users SET referred_by = invited_by WHERE referred_by IS NULL AND invited_by IS NOT NULL`)
  await runAsync(db, `UPDATE users SET is_owner = CASE WHEN role = 'owner' THEN 1 ELSE 0 END`)
  const vipDefaults = [
    [1, 'VIP 1', 500, 4],
    [2, 'VIP 2', 1500, 5],
    [3, 'VIP 3', 3000, 6],
    [4, 'VIP 4', 7000, 7],
    [5, 'VIP 5', 15000, 8],
  ]
  for (const [level, title, minDeposit, referralPercent] of vipDefaults) {
    await runAsync(
      db,
      `INSERT INTO vip_tiers (level, title, min_deposit, min_trade_volume, referral_multiplier, referral_percent, perks_json, is_active)
       VALUES (?, ?, ?, 0, 1, ?, '[]', 1)
       ON CONFLICT(level) DO NOTHING`,
      [level, title, minDeposit, referralPercent],
    )
  }
  try {
    for (const [code, name, desc, sortOrder] of [
      ['mining', 'Mining', 'Mining subscription earnings', 1],
      ['tasks', 'Tasks', 'Task reward redemptions', 2],
      ['referrals', 'Referrals', 'Referral rewards', 3],
      ['deposits', 'Deposits', 'Deposit-based bonuses', 4],
    ]) {
      await runAsync(db, `INSERT OR IGNORE INTO earning_sources (code, name, description, is_active, sort_order) VALUES (?, ?, ?, 1, ?)`, [code, name, desc, sortOrder])
    }
  } catch (_) {}
  // IMPORTANT: first 3000 IDs are reserved. New auto IDs start from 3001+.
  await reserveFirst3000IdsSqlite(db)
}

export async function openSqliteDb() {
  const db = await createDb()
  await ensureSchema(db)
  return createPgLikeWrapper(db)
}
