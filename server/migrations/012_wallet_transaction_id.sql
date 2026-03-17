-- Phase 2: Add wallet_transaction_id as primary financial reference for deposit/withdrawal requests.
-- processed_txn_id remains for legacy compatibility only.

-- PostgreSQL
ALTER TABLE deposit_requests ADD COLUMN IF NOT EXISTS wallet_transaction_id INTEGER REFERENCES wallet_transactions(id) ON DELETE SET NULL;
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS wallet_transaction_id INTEGER REFERENCES wallet_transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deposit_requests_wallet_txn ON deposit_requests(wallet_transaction_id) WHERE wallet_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_wallet_txn ON withdrawal_requests(wallet_transaction_id) WHERE wallet_transaction_id IS NOT NULL;
