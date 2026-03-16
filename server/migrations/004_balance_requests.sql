-- Financial requests system (deposits / withdrawals)

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
