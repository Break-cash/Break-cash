-- Final legacy retirement: drop processed_txn_id.
-- wallet_transaction_id is the sole financial reference.

-- PostgreSQL: drop FK column
ALTER TABLE deposit_requests DROP COLUMN IF EXISTS processed_txn_id;
ALTER TABLE withdrawal_requests DROP COLUMN IF EXISTS processed_txn_id;
