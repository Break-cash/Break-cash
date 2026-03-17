# Legacy Dependencies (Phase 2)

**Last updated**: Phase 2 completion.

## Active Runtime Paths – No Legacy Reads

All active financial and read paths now use `wallet_accounts` and `wallet_transactions` as the source of truth.

| Route/Service | Status |
|---------------|--------|
| `GET /api/balance/my` | ✅ wallet_accounts only |
| `GET /api/balance/getUser` | ✅ wallet_accounts only |
| `GET /api/balance/history` | ✅ wallet_transactions only |
| `GET /api/balance/wallet-history` | ✅ wallet_transactions |
| `GET /api/balance/earning-history` | ✅ earning_entries |
| `GET /api/users/list` | ✅ wallet_accounts, wallet_transactions |
| `GET /api/users/:id/profile` | ✅ wallet_accounts, wallet_transactions |
| `GET /api/stats/balanceStats` | ✅ wallet_accounts, wallet_transactions |
| `GET /api/stats/transactionStats` | ✅ wallet_transactions |
| `GET /api/friends/search` | ✅ wallet_accounts |
| `GET /api/owner-growth/referrals` | ✅ wallet_transactions |
| `GET /api/owner-growth/content-campaigns` (target filters) | ✅ wallet_transactions |
| `GET /api/mining/my` (monthly aggregate) | ✅ wallet_transactions |
| `markReferralAsVerifiedIfDeposited` | ✅ wallet_transactions |

## Legacy Write-Only (One-Way Sync)

These functions **write** to legacy tables only. No reads from legacy in active paths.

| Location | Function | Purpose |
|----------|----------|---------|
| `wallet-ledger.js` | `syncToLegacyBalances()` | Sync wallet_accounts → balances |
| `wallet-ledger.js` | `appendLegacyBalanceTransaction()` | Append to balance_transactions for processed_txn_id FK |

**Phase 2**: Legacy sync remains for backward compatibility. `wallet_transaction_id` is now primary; `processed_txn_id` is kept temporarily.

## Legacy Read – Reconciliation Only

| Location | Purpose |
|----------|---------|
| `wallet-reconciliation.js` | `getLegacyBalance()`, `reconcileUserCurrency()` | Compare wallet vs legacy for integrity checks |

## Bootstrap Migration (Startup Only)

| Location | Purpose |
|----------|---------|
| `db.js` | `INSERT INTO wallet_accounts ... SELECT FROM balances` | One-time sync for existing users |
| `db-sqlite.js` | Same | Same for SQLite |

## Tables

| Table | Role |
|-------|------|
| `balances` | Write-only from wallet; archive |
| `balance_transactions` | Write-only from wallet; archive |
| `deposit_requests.processed_txn_id` | Legacy FK; kept for compatibility |
| `withdrawal_requests.processed_txn_id` | Legacy FK; kept for compatibility |
| `deposit_requests.wallet_transaction_id` | **Primary** financial reference |
| `withdrawal_requests.wallet_transaction_id` | **Primary** financial reference |
