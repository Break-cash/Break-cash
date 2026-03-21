import { Pool } from 'pg'
import { getDefaultVipTierRows } from './services/vip-rules.js'

function normalizeSql(sql) {
  return sql
    .replaceAll("datetime('now')", 'CURRENT_TIMESTAMP')
    .replaceAll("datetime('now', '+10 minutes')", "(CURRENT_TIMESTAMP + INTERVAL '10 minutes')")
}

function toPgPlaceholders(sql) {
  let idx = 0
  return sql.replace(/\?/g, () => `$${++idx}`)
}

function prep(sql) {
  return toPgPlaceholders(normalizeSql(sql))
}

export async function run(db, sql, params = []) {
  const query = prep(sql)
  const result = await db.query(query, params)
  const lastID = result.rows?.[0]?.id ?? null
  return { lastID, changes: result.rowCount || 0, rows: result.rows || [] }
}

export async function get(db, sql, params = []) {
  const query = prep(sql)
  const result = await db.query(query, params)
  return result.rows?.[0] || null
}

export async function all(db, sql, params = []) {
  const query = prep(sql)
  const result = await db.query(query, params)
  return result.rows || []
}

const RESERVED_ID_FLOOR = 3000

async function reserveFirst3000IdsPg(db) {
  const idTables = await all(
    db,
    `SELECT table_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND column_name = 'id'
       AND (
         is_identity = 'YES'
         OR column_default LIKE 'nextval(%'
       )`,
  )
  for (const row of idTables) {
    const tableName = String(row?.table_name || '')
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) continue
    const seqRow = await get(db, `SELECT pg_get_serial_sequence(?, 'id') AS seq`, [`public.${tableName}`])
    const sequenceName = String(seqRow?.seq || '').trim()
    if (!sequenceName) continue
    const maxRow = await db.query(`SELECT COALESCE(MAX(id), 0) AS max_id FROM "${tableName}"`)
    const currentMax = Number(maxRow.rows?.[0]?.max_id || 0)
    const targetValue = Math.max(RESERVED_ID_FLOOR, currentMax)
    await db.query(`SELECT setval($1, $2, true)`, [sequenceName, targetValue])
  }
}

async function ensureSchema(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE,
      phone TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      is_approved INTEGER NOT NULL DEFAULT 0,
      is_banned INTEGER NOT NULL DEFAULT 0,
      is_frozen INTEGER NOT NULL DEFAULT 0,
      banned_until TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      display_name TEXT,
      bio TEXT,
      avatar_path TEXT,
      verification_status TEXT NOT NULL DEFAULT 'unverified',
      phone_verified INTEGER NOT NULL DEFAULT 0,
      identity_submitted INTEGER NOT NULL DEFAULT 0,
      verification_ready_at TIMESTAMP,
      blue_badge INTEGER NOT NULL DEFAULT 0,
      vip_level INTEGER NOT NULL DEFAULT 0,
      profile_color TEXT,
      profile_badge TEXT,
      country TEXT,
      preferred_language TEXT,
      preferred_currency TEXT,
      referral_code TEXT UNIQUE,
      invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      referred_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      total_deposit DOUBLE PRECISION NOT NULL DEFAULT 0,
      points INTEGER NOT NULL DEFAULT 0,
      is_owner INTEGER NOT NULL DEFAULT 0,
      last_login_at TIMESTAMP,
      last_ip TEXT,
      last_user_agent TEXT,
      two_factor_enabled INTEGER NOT NULL DEFAULT 0,
      two_factor_for_admin_actions INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS invites (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      used_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      used_at TIMESTAMP,
      expires_at TIMESTAMP,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS watchlist (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      symbol TEXT NOT NULL,
      market_type TEXT NOT NULL DEFAULT 'crypto',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, symbol)
    );
    CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id);

    CREATE TABLE IF NOT EXISTS portfolio_holdings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      symbol TEXT NOT NULL,
      quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
      avg_price DOUBLE PRECISION NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, symbol)
    );
    CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_user_id ON portfolio_holdings(user_id);

    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL,
      quantity DOUBLE PRECISION NOT NULL,
      price DOUBLE PRECISION NOT NULL,
      fee DOUBLE PRECISION NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'filled',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);

    CREATE TABLE IF NOT EXISTS balances (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      currency TEXT NOT NULL,
      amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, currency)
    );

    CREATE TABLE IF NOT EXISTS balance_transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      currency TEXT NOT NULL,
      amount DOUBLE PRECISION NOT NULL,
      note TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_balance_transactions_user_id ON balance_transactions(user_id);

    CREATE TABLE IF NOT EXISTS deposit_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount DOUBLE PRECISION NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USDT',
      method TEXT NOT NULL,
      transfer_ref TEXT NOT NULL,
      user_notes TEXT,
      proof_image_path TEXT,
      request_status TEXT NOT NULL DEFAULT 'pending',
      admin_note TEXT,
      reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMP,
      completed_at TIMESTAMP,
      processed_txn_id INTEGER REFERENCES balance_transactions(id) ON DELETE SET NULL,
      idempotency_key TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_deposit_requests_user_id ON deposit_requests(user_id);
    CREATE INDEX IF NOT EXISTS idx_deposit_requests_status ON deposit_requests(request_status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_deposit_requests_idempotency
      ON deposit_requests(user_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL;

    CREATE TABLE IF NOT EXISTS withdrawal_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount DOUBLE PRECISION NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USDT',
      method TEXT NOT NULL,
      account_info TEXT NOT NULL,
      user_notes TEXT,
      request_status TEXT NOT NULL DEFAULT 'pending',
      admin_note TEXT,
      reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMP,
      completed_at TIMESTAMP,
      processed_txn_id INTEGER REFERENCES balance_transactions(id) ON DELETE SET NULL,
      idempotency_key TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON withdrawal_requests(user_id);
    CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(request_status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawal_requests_idempotency
      ON withdrawal_requests(user_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL;

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

    CREATE TABLE IF NOT EXISTS permissions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      permission TEXT NOT NULL,
      granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, permission)
    );

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

    CREATE TABLE IF NOT EXISTS strategy_codes (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      feature_type TEXT NOT NULL DEFAULT 'trial_trade',
      reward_mode TEXT NOT NULL DEFAULT 'percent',
      reward_value DOUBLE PRECISION NOT NULL DEFAULT 0,
      asset_symbol TEXT NOT NULL DEFAULT 'BTCUSDT',
      trade_return_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
      expires_at TIMESTAMP,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_strategy_codes_active ON strategy_codes(is_active);

    CREATE TABLE IF NOT EXISTS strategy_code_usages (
      id SERIAL PRIMARY KEY,
      code_id INTEGER NOT NULL REFERENCES strategy_codes(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending_confirmation',
      selected_symbol TEXT,
      feature_type TEXT NOT NULL DEFAULT 'trial_trade',
      balance_snapshot DOUBLE PRECISION NOT NULL DEFAULT 0,
      stake_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      reward_value DOUBLE PRECISION NOT NULL DEFAULT 0,
      trade_return_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
      entry_price DOUBLE PRECISION,
      exit_price DOUBLE PRECISION,
      wallet_debit_txn_id INTEGER,
      wallet_credit_txn_id INTEGER,
      metadata_json TEXT,
      confirmed_at TIMESTAMP,
      settled_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(code_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_strategy_code_usages_user ON strategy_code_usages(user_id);
    CREATE INDEX IF NOT EXISTS idx_strategy_code_usages_status ON strategy_code_usages(status);

    CREATE TABLE IF NOT EXISTS mining_profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'inactive',
      currency TEXT NOT NULL DEFAULT 'USDT',
      video_access_unlocked INTEGER NOT NULL DEFAULT 0,
      video_access_unlocked_at TIMESTAMP,
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

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

    CREATE TABLE IF NOT EXISTS settings (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS phone_verification_codes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      phone TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_phone_verification_codes_expires ON phone_verification_codes(expires_at);

    CREATE TABLE IF NOT EXISTS password_reset_codes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      identifier TEXT NOT NULL,
      channel TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_password_reset_codes_user ON password_reset_codes(user_id);
    CREATE INDEX IF NOT EXISTS idx_password_reset_codes_expires ON password_reset_codes(expires_at);

    CREATE TABLE IF NOT EXISTS user_recovery_codes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      recovery_code TEXT NOT NULL UNIQUE,
      generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      acknowledged_at TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_user_recovery_codes_user ON user_recovery_codes(user_id);

    CREATE TABLE IF NOT EXISTS recovery_code_review_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recovery_code TEXT NOT NULL,
      request_status TEXT NOT NULL DEFAULT 'pending',
      request_note TEXT,
      contact_channel TEXT,
      contact_value TEXT,
      submitted_ip TEXT,
      submitted_user_agent TEXT,
      reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_recovery_requests_user_status
      ON recovery_code_review_requests(user_id, request_status, created_at DESC);

    CREATE TABLE IF NOT EXISTS user_reward_mode_overrides (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      payout_mode TEXT NOT NULL DEFAULT 'withdrawable',
      note TEXT,
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_user_reward_mode_overrides_user
      ON user_reward_mode_overrides(user_id);

    CREATE TABLE IF NOT EXISTS kyc_submissions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      id_document_path TEXT NOT NULL,
      selfie_path TEXT NOT NULL,
      review_status TEXT NOT NULL DEFAULT 'pending',
      rejection_reason TEXT,
      full_name_match_score DOUBLE PRECISION,
      face_match_score DOUBLE PRECISION,
      aml_risk_level TEXT NOT NULL DEFAULT 'low',
      auto_review_at TIMESTAMP,
      reviewed_note TEXT,
      reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_kyc_submissions_review_status ON kyc_submissions(review_status);
    CREATE INDEX IF NOT EXISTS idx_kyc_submissions_user_id ON kyc_submissions(user_id);

    CREATE TABLE IF NOT EXISTS friend_requests (
      id SERIAL PRIMARY KEY,
      from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(from_user_id, to_user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON friend_requests(to_user_id);
    CREATE INDEX IF NOT EXISTS idx_friend_requests_from ON friend_requests(from_user_id);

    CREATE TABLE IF NOT EXISTS user_admin_notes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      note TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_user_admin_notes_user_id ON user_admin_notes(user_id);

    CREATE TABLE IF NOT EXISTS user_activity_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      metadata TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON user_activity_logs(user_id);

    CREATE TABLE IF NOT EXISTS daily_trade_campaigns (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      symbol TEXT,
      side TEXT,
      entry_price DOUBLE PRECISION,
      take_profit DOUBLE PRECISION,
      stop_loss DOUBLE PRECISION,
      success_rate DOUBLE PRECISION DEFAULT 0,
      visibility_scope TEXT NOT NULL DEFAULT 'all',
      min_vip_level INTEGER NOT NULL DEFAULT 0,
      is_visible INTEGER NOT NULL DEFAULT 1,
      starts_at TIMESTAMP,
      ends_at TIMESTAMP,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bonus_rules (
      id SERIAL PRIMARY KEY,
      rule_type TEXT NOT NULL,
      title TEXT NOT NULL,
      conditions_json TEXT,
      reward_json TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      starts_at TIMESTAMP,
      ends_at TIMESTAMP,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vip_tiers (
      id SERIAL PRIMARY KEY,
      level INTEGER NOT NULL UNIQUE,
      title TEXT NOT NULL,
      min_deposit DOUBLE PRECISION NOT NULL DEFAULT 0,
      min_trade_volume DOUBLE PRECISION NOT NULL DEFAULT 0,
      referral_multiplier DOUBLE PRECISION NOT NULL DEFAULT 1,
      referral_percent DOUBLE PRECISION NOT NULL DEFAULT 3,
      perks_json TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS referral_rewards (
      id SERIAL PRIMARY KEY,
      referrer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      referred_user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      deposit_request_id INTEGER REFERENCES deposit_requests(id) ON DELETE SET NULL,
      source_amount DOUBLE PRECISION NOT NULL,
      reward_percent DOUBLE PRECISION NOT NULL,
      reward_amount DOUBLE PRECISION NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON referral_rewards(referrer_user_id);
    CREATE INDEX IF NOT EXISTS idx_referral_rewards_referred ON referral_rewards(referred_user_id);

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

    CREATE TABLE IF NOT EXISTS partner_profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      commission_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS content_campaigns (
      id SERIAL PRIMARY KEY,
      campaign_type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      target_filters_json TEXT,
      schedule_at TIMESTAMP,
      expires_at TIMESTAMP,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL UNIQUE,
      token_hash TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      revoked_at TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, is_active);

    CREATE TABLE IF NOT EXISTS login_attempts (
      id SERIAL PRIMARY KEY,
      identifier TEXT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ip_address TEXT,
      user_agent TEXT,
      success INTEGER NOT NULL DEFAULT 0,
      failure_reason TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_created ON login_attempts(ip_address, created_at);

    CREATE TABLE IF NOT EXISTS security_alerts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      alert_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'medium',
      ip_address TEXT,
      user_agent TEXT,
      metadata TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_security_alerts_user_created ON security_alerts(user_id, created_at);

    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id SERIAL PRIMARY KEY,
      actor_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      section TEXT NOT NULL,
      action TEXT NOT NULL,
      metadata TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor_created ON admin_audit_logs(actor_user_id, created_at);

    CREATE TABLE IF NOT EXISTS admin_staff_profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      admin_role TEXT NOT NULL DEFAULT 'admin',
      is_active INTEGER NOT NULL DEFAULT 1,
      can_view_sensitive INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS kyc_watchlist (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      note TEXT NOT NULL,
      source TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)

  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_frozen INTEGER NOT NULL DEFAULT 0`)
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_until TIMESTAMP`)
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT`)
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language TEXT`)
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_currency TEXT`)
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT`)
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL`)
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by INTEGER REFERENCES users(id) ON DELETE SET NULL`)
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS total_deposit DOUBLE PRECISION NOT NULL DEFAULT 0`)
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0`)
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_owner INTEGER NOT NULL DEFAULT 0`)
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP`)
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ip TEXT`)
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_user_agent TEXT`)
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT`)
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_color TEXT`)
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_badge TEXT`)
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled INTEGER NOT NULL DEFAULT 0`)
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_for_admin_actions INTEGER NOT NULL DEFAULT 0`)
  await db.query(`ALTER TABLE deposit_requests ADD COLUMN IF NOT EXISTS proof_image_path TEXT`)
  await db.query(`ALTER TABLE deposit_requests ADD COLUMN IF NOT EXISTS request_status TEXT NOT NULL DEFAULT 'pending'`)
  await db.query(`ALTER TABLE deposit_requests ADD COLUMN IF NOT EXISTS admin_note TEXT`)
  await db.query(`ALTER TABLE deposit_requests ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL`)
  await db.query(`ALTER TABLE deposit_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP`)
  await db.query(`ALTER TABLE deposit_requests ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP`)
  await db.query(`ALTER TABLE deposit_requests ADD COLUMN IF NOT EXISTS processed_txn_id INTEGER REFERENCES balance_transactions(id) ON DELETE SET NULL`)
  await db.query(`ALTER TABLE deposit_requests ADD COLUMN IF NOT EXISTS idempotency_key TEXT`)
  await db.query(`ALTER TABLE deposit_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`)
  await db.query(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS request_status TEXT NOT NULL DEFAULT 'pending'`)
  await db.query(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS admin_note TEXT`)
  await db.query(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL`)
  await db.query(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP`)
  await db.query(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP`)
  await db.query(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS processed_txn_id INTEGER REFERENCES balance_transactions(id) ON DELETE SET NULL`)
  await db.query(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS idempotency_key TEXT`)
  await db.query(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`)
  await db.query(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS fee_percent DOUBLE PRECISION NOT NULL DEFAULT 0`)
  await db.query(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS fee_amount DOUBLE PRECISION NOT NULL DEFAULT 0`)
  await db.query(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS payout_amount DOUBLE PRECISION NOT NULL DEFAULT 0`)
  await db.query(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS vip_level INTEGER NOT NULL DEFAULT 0`)
  await db.query(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS processing_hours_min INTEGER`)
  await db.query(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS processing_hours_max INTEGER`)
  await db.query(`ALTER TABLE user_principal_locks ADD COLUMN IF NOT EXISTS required_profit_amount DOUBLE PRECISION NOT NULL DEFAULT 0`)
  await db.query(`ALTER TABLE user_principal_locks ADD COLUMN IF NOT EXISTS unlock_ratio DOUBLE PRECISION NOT NULL DEFAULT 1`)
  await db.query(`ALTER TABLE user_principal_locks ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'deposit_request'`)
  await db.query(`ALTER TABLE user_principal_locks ADD COLUMN IF NOT EXISTS source_id INTEGER`)
  await db.query(`ALTER TABLE user_principal_locks ADD COLUMN IF NOT EXISTS lock_status TEXT NOT NULL DEFAULT 'locked'`)
  await db.query(`ALTER TABLE user_principal_locks ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMP`)
  await db.query(`ALTER TABLE user_principal_locks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`)
  await db.query(`ALTER TABLE user_unlock_overrides ADD COLUMN IF NOT EXISTS force_unlock_principal INTEGER NOT NULL DEFAULT 0`)
  await db.query(`ALTER TABLE user_unlock_overrides ADD COLUMN IF NOT EXISTS custom_unlock_ratio DOUBLE PRECISION`)
  await db.query(`ALTER TABLE user_unlock_overrides ADD COLUMN IF NOT EXISTS custom_min_profit DOUBLE PRECISION`)
  await db.query(`ALTER TABLE user_unlock_overrides ADD COLUMN IF NOT EXISTS note TEXT`)
  await db.query(`ALTER TABLE user_unlock_overrides ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL`)
  await db.query(`ALTER TABLE user_unlock_overrides ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`)
  await db.query(`ALTER TABLE recovery_code_review_requests ADD COLUMN IF NOT EXISTS contact_channel TEXT`)
  await db.query(`ALTER TABLE recovery_code_review_requests ADD COLUMN IF NOT EXISTS contact_value TEXT`)
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_reward_mode_overrides (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      payout_mode TEXT NOT NULL DEFAULT 'withdrawable',
      note TEXT,
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_user_reward_mode_overrides_user ON user_reward_mode_overrides(user_id)`)
  await db.query(`ALTER TABLE mining_profiles ADD COLUMN IF NOT EXISTS video_access_unlocked INTEGER NOT NULL DEFAULT 0`)
  await db.query(`ALTER TABLE mining_profiles ADD COLUMN IF NOT EXISTS video_access_unlocked_at TIMESTAMP`)
  await db.query(`ALTER TABLE strategy_codes ADD COLUMN IF NOT EXISTS feature_type TEXT NOT NULL DEFAULT 'trial_trade'`)
  await db.query(`ALTER TABLE strategy_codes ADD COLUMN IF NOT EXISTS reward_mode TEXT NOT NULL DEFAULT 'percent'`)
  await db.query(`ALTER TABLE strategy_codes ADD COLUMN IF NOT EXISTS reward_value DOUBLE PRECISION NOT NULL DEFAULT 0`)
  await db.query(`ALTER TABLE strategy_codes ADD COLUMN IF NOT EXISTS asset_symbol TEXT NOT NULL DEFAULT 'BTCUSDT'`)
  await db.query(`ALTER TABLE strategy_codes ADD COLUMN IF NOT EXISTS trade_return_percent DOUBLE PRECISION NOT NULL DEFAULT 0`)
  await db.query(`ALTER TABLE strategy_codes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP`)
  await db.query(`ALTER TABLE strategy_codes ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL`)
  await db.query(`ALTER TABLE strategy_codes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`)
  await db.query(`ALTER TABLE strategy_codes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_strategy_codes_active ON strategy_codes(is_active)`)
  await db.query(`ALTER TABLE strategy_code_usages ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending_confirmation'`)
  await db.query(`ALTER TABLE strategy_code_usages ADD COLUMN IF NOT EXISTS selected_symbol TEXT`)
  await db.query(`ALTER TABLE strategy_code_usages ADD COLUMN IF NOT EXISTS feature_type TEXT NOT NULL DEFAULT 'trial_trade'`)
  await db.query(`ALTER TABLE strategy_code_usages ADD COLUMN IF NOT EXISTS balance_snapshot DOUBLE PRECISION NOT NULL DEFAULT 0`)
  await db.query(`ALTER TABLE strategy_code_usages ADD COLUMN IF NOT EXISTS stake_amount DOUBLE PRECISION NOT NULL DEFAULT 0`)
  await db.query(`ALTER TABLE strategy_code_usages ADD COLUMN IF NOT EXISTS reward_value DOUBLE PRECISION NOT NULL DEFAULT 0`)
  await db.query(`ALTER TABLE strategy_code_usages ADD COLUMN IF NOT EXISTS trade_return_percent DOUBLE PRECISION NOT NULL DEFAULT 0`)
  await db.query(`ALTER TABLE strategy_code_usages ADD COLUMN IF NOT EXISTS entry_price DOUBLE PRECISION`)
  await db.query(`ALTER TABLE strategy_code_usages ADD COLUMN IF NOT EXISTS exit_price DOUBLE PRECISION`)
  await db.query(`ALTER TABLE strategy_code_usages ADD COLUMN IF NOT EXISTS wallet_debit_txn_id INTEGER REFERENCES wallet_transactions(id) ON DELETE SET NULL`)
  await db.query(`ALTER TABLE strategy_code_usages ADD COLUMN IF NOT EXISTS wallet_credit_txn_id INTEGER REFERENCES wallet_transactions(id) ON DELETE SET NULL`)
  await db.query(`ALTER TABLE strategy_code_usages ADD COLUMN IF NOT EXISTS metadata_json TEXT`)
  await db.query(`ALTER TABLE strategy_code_usages ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP`)
  await db.query(`ALTER TABLE strategy_code_usages ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP`)
  await db.query(`ALTER TABLE strategy_code_usages ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`)
  await db.query(`ALTER TABLE strategy_code_usages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_strategy_code_usages_user ON strategy_code_usages(user_id)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_strategy_code_usages_status ON strategy_code_usages(status)`)
  await db.query(`ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending'`)
  await db.query(`ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS rejection_reason TEXT`)
  await db.query(`ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS full_name_match_score DOUBLE PRECISION`)
  await db.query(`ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS face_match_score DOUBLE PRECISION`)
  await db.query(`ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS aml_risk_level TEXT NOT NULL DEFAULT 'low'`)
  await db.query(`ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS auto_review_at TIMESTAMP`)
  await db.query(`ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS reviewed_note TEXT`)
  await db.query(`ALTER TABLE vip_tiers ADD COLUMN IF NOT EXISTS referral_percent DOUBLE PRECISION NOT NULL DEFAULT 3`)
  await db.query(`ALTER TABLE referral_rewards ADD COLUMN IF NOT EXISTS level_depth INTEGER NOT NULL DEFAULT 1`)
  await db.query(`ALTER TABLE referral_rewards DROP CONSTRAINT IF EXISTS referral_rewards_referred_user_id_key`).catch(() => {})
  await db.query(`DROP INDEX IF EXISTS idx_referral_rewards_referred_unique`).catch(() => {})
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_rewards_referrer_referred_depth ON referral_rewards(referrer_user_id, referred_user_id, level_depth)`)
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_users_total_deposit ON users(total_deposit)`)
  await db.query(`UPDATE users SET referred_by = invited_by WHERE referred_by IS NULL AND invited_by IS NOT NULL`)
  await db.query(`UPDATE users SET is_owner = CASE WHEN role = 'owner' THEN 1 ELSE 0 END`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_user_id ON portfolio_holdings(user_id)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_balance_transactions_user_id ON balance_transactions(user_id)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_deposit_requests_user_id ON deposit_requests(user_id)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_deposit_requests_status ON deposit_requests(request_status)`)
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_deposit_requests_idempotency ON deposit_requests(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON withdrawal_requests(user_id)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(request_status)`)
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawal_requests_idempotency ON withdrawal_requests(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_user_principal_locks_user_currency ON user_principal_locks(user_id, currency, lock_status)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_phone_verification_codes_expires ON phone_verification_codes(expires_at)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_password_reset_codes_expires ON password_reset_codes(expires_at)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_kyc_submissions_review_status ON kyc_submissions(review_status)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_kyc_submissions_user_id ON kyc_submissions(user_id)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON referral_rewards(referrer_user_id)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_referral_rewards_referred ON referral_rewards(referred_user_id)`)
  await db.query(`
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
    )
  `)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_user_id)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status)`)
  await db.query(`
    INSERT INTO referrals (referrer_user_id, referred_user_id, status, qualified_at, reward_released_at, qualifying_deposit_request_id, first_deposit_amount, reward_amount, reward_percent)
    SELECT u.referred_by, u.id, CASE WHEN rr.id IS NOT NULL THEN 'reward_released' ELSE 'pending' END,
           rr.created_at, rr.created_at, rr.deposit_request_id, rr.source_amount, rr.reward_amount, rr.reward_percent
    FROM users u
    LEFT JOIN referral_rewards rr ON rr.referred_user_id = u.id
    WHERE u.referred_by IS NOT NULL AND u.referred_by <> u.id
      AND NOT EXISTS (SELECT 1 FROM referrals r WHERE r.referred_user_id = u.id)
  `).catch(() => {})
  await db.query(`UPDATE users SET referred_by = invited_by WHERE referred_by IS NULL AND invited_by IS NOT NULL`)
  await db.query(`UPDATE users SET is_owner = CASE WHEN role = 'owner' THEN 1 ELSE 0 END`)
  for (const tier of getDefaultVipTierRows()) {
    await db.query(
      prep(
        `INSERT INTO vip_tiers (
          level, title, min_deposit, min_trade_volume, referral_multiplier, referral_percent, perks_json, is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT(level) DO UPDATE SET
          title = excluded.title,
          min_deposit = excluded.min_deposit,
          min_trade_volume = excluded.min_trade_volume,
          referral_multiplier = excluded.referral_multiplier,
          referral_percent = excluded.referral_percent,
          perks_json = excluded.perks_json,
          is_active = 1`,
      ),
      [
        tier.level,
        tier.title,
        tier.minDeposit,
        tier.minTeamVolume,
        tier.minReferrals,
        tier.referralPercent,
        JSON.stringify(tier),
      ],
    )
  }
  await db.query(`
    CREATE TABLE IF NOT EXISTS ads (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('image', 'video')),
      media_url TEXT NOT NULL,
      title TEXT,
      description TEXT,
      link_url TEXT,
      placement TEXT NOT NULL DEFAULT 'all',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_ads_placement ON ads(placement)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_ads_is_active ON ads(is_active)`)

  // Multi-source financial architecture
  await db.query(`
    CREATE TABLE IF NOT EXISTS earning_sources (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      config_json TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_earning_sources_code ON earning_sources(code)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_earning_sources_active ON earning_sources(is_active)`)

  await db.query(`
    CREATE TABLE IF NOT EXISTS wallet_accounts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      currency TEXT NOT NULL DEFAULT 'USDT',
      account_type TEXT NOT NULL DEFAULT 'main',
      source_type TEXT NOT NULL DEFAULT 'system',
      balance_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, currency, account_type, source_type)
    )
  `)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_wallet_accounts_user ON wallet_accounts(user_id)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_wallet_accounts_user_currency ON wallet_accounts(user_id, currency)`)

  await db.query(`
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      currency TEXT NOT NULL DEFAULT 'USDT',
      transaction_type TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'system',
      reference_type TEXT,
      reference_id INTEGER,
      amount DOUBLE PRECISION NOT NULL,
      fee_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      net_amount DOUBLE PRECISION NOT NULL,
      balance_before DOUBLE PRECISION,
      balance_after DOUBLE PRECISION,
      account_type_before TEXT,
      account_type_after TEXT,
      metadata TEXT,
      idempotency_key TEXT UNIQUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
    )
  `)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON wallet_transactions(user_id)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_created ON wallet_transactions(user_id, created_at DESC)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference ON wallet_transactions(reference_type, reference_id)`)
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_transactions_idempotency ON wallet_transactions(idempotency_key) WHERE idempotency_key IS NOT NULL`)

  await db.query(`ALTER TABLE deposit_requests ADD COLUMN IF NOT EXISTS wallet_transaction_id INTEGER REFERENCES wallet_transactions(id) ON DELETE SET NULL`)
  await db.query(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS wallet_transaction_id INTEGER REFERENCES wallet_transactions(id) ON DELETE SET NULL`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_deposit_requests_wallet_txn ON deposit_requests(wallet_transaction_id) WHERE wallet_transaction_id IS NOT NULL`).catch(() => {})
  await db.query(`CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_wallet_txn ON withdrawal_requests(wallet_transaction_id) WHERE wallet_transaction_id IS NOT NULL`).catch(() => {})

  await db.query(`ALTER TABLE deposit_requests DROP COLUMN IF EXISTS processed_txn_id`).catch(() => {})
  await db.query(`ALTER TABLE withdrawal_requests DROP COLUMN IF EXISTS processed_txn_id`).catch(() => {})

  await db.query(`
    CREATE TABLE IF NOT EXISTS earning_entries (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source_type TEXT NOT NULL,
      reference_type TEXT NOT NULL,
      reference_id INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USDT',
      amount DOUBLE PRECISION NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      transferred_at TIMESTAMP,
      transferred_wallet_txn_id INTEGER REFERENCES wallet_transactions(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_type, reference_type, reference_id)
    )
  `)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_earning_entries_user ON earning_entries(user_id)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_earning_entries_status ON earning_entries(status)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_earning_entries_reference ON earning_entries(reference_type, reference_id)`)

  await db.query(`
    CREATE TABLE IF NOT EXISTS mining_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      currency TEXT NOT NULL DEFAULT 'USDT',
      status TEXT NOT NULL DEFAULT 'inactive',
      principal_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      daily_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
      monthly_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
      emergency_fee_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
      started_at TIMESTAMP,
      ended_at TIMESTAMP,
      monthly_lock_until TIMESTAMP,
      last_daily_claim_at TIMESTAMP,
      daily_profit_claimed_total DOUBLE PRECISION NOT NULL DEFAULT 0,
      monthly_profit_accrued_total DOUBLE PRECISION NOT NULL DEFAULT 0,
      returned_principal DOUBLE PRECISION NOT NULL DEFAULT 0,
      penalty_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      closure_reason TEXT,
      cancel_requested_at TIMESTAMP,
      principal_release_at TIMESTAMP,
      principal_released_at TIMESTAMP,
      emergency_withdrawn_at TIMESTAMP,
      video_access_unlocked INTEGER NOT NULL DEFAULT 0,
      video_access_unlocked_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_mining_subscriptions_status ON mining_subscriptions(status)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_mining_subscriptions_user ON mining_subscriptions(user_id)`)

  // Seed earning sources (extensible registry)
  await db.query(`
    INSERT INTO earning_sources (code, name, description, is_active, sort_order)
    VALUES
      ('mining', 'Mining', 'Mining subscription earnings', 1, 1),
      ('tasks', 'Tasks', 'Task reward redemptions', 1, 2),
      ('referrals', 'Referrals', 'Referral rewards', 1, 3),
      ('deposits', 'Deposits', 'Deposit-based bonuses', 1, 4)
    ON CONFLICT(code) DO NOTHING
  `).catch(() => {})

  // IMPORTANT: first 3000 IDs are reserved. New auto IDs start from 3001+.
  await reserveFirst3000IdsPg(db)
}

export async function openDb() {
  const useSqlite = process.env.USE_SQLITE === '1' || process.env.USE_SQLITE === 'true'
  const connectionString = (process.env.DATABASE_URL || '').trim()

  if (useSqlite || !connectionString || connectionString.includes('${{')) {
    const { openSqliteDb } = await import('./db-sqlite.js')
    console.log('[db] Using SQLite for local development')
    return openSqliteDb()
  }

  const db = new Pool({
    connectionString,
    ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
  })
  await db.query('SELECT 1')
  await ensureSchema(db)
  return db
}

