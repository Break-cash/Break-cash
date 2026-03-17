# Phase 2: Legacy Detachment – Report

## Files Changed

| File | Changes |
|------|---------|
| `server/db.js` | Added `wallet_transaction_id` to deposit_requests, withdrawal_requests; indexes |
| `server/db-sqlite.js` | Added `wallet_transaction_id` column to deposit_requests, withdrawal_requests |
| `server/migrations/012_wallet_transaction_id.sql` | New migration for PostgreSQL |
| `server/routes/balance.js` | wallet_transaction_id in deposit/withdrawal updates; history from wallet_transactions; removed legacy fallbacks from /my, /getUser |
| `server/routes/users.js` | Migrated to wallet_accounts, wallet_transactions; hasPendingWithdrawal from withdrawal_requests |
| `server/routes/owner-growth.js` | Migrated deposits_total to wallet_transactions |
| `server/routes/stats.js` | Migrated balanceStats, transactionStats to wallet-reads |
| `server/routes/friends.js` | Migrated trading_balance to wallet_accounts |
| `server/routes/mining.js` | Migrated monthly aggregate to wallet_transactions |
| `server/services/wallet-ledger.js` | Removed legacy fallback from getMainBalance; marked sync functions LEGACY |
| `server/services/wallet-reads.js` | **New** – wallet-based read helpers |
| `server/services/verification.js` | Migrated hasDeposit check to wallet_transactions |
| `server/docs/MIGRATION_ROLLOUT.md` | Phase 2 marked complete |
| `server/docs/LEGACY_DEPENDENCIES.md` | **New** – documents remaining legacy usage |
| `server/docs/PHASE2_REPORT.md` | **New** – this report |

## Routes Fully Migrated

| Route | Source |
|-------|--------|
| `GET /api/balance/my` | wallet_accounts |
| `GET /api/balance/getUser` | wallet_accounts |
| `GET /api/balance/history` | wallet_transactions |
| `GET /api/balance/wallet-history` | wallet_transactions |
| `GET /api/balance/earning-history` | earning_entries |
| `GET /api/users/list` | wallet_accounts, wallet_transactions, withdrawal_requests |
| `GET /api/users/:id/profile` | wallet_accounts, wallet_transactions |
| `GET /api/stats/balanceStats` | wallet_accounts, wallet_transactions |
| `GET /api/stats/transactionStats` | wallet_transactions |
| `GET /api/friends/search` | wallet_accounts |
| `GET /api/owner-growth/referrals` | wallet_transactions |
| `GET /api/owner-growth/content-campaigns` (target filters) | wallet_transactions |
| `GET /api/mining/my` (monthly aggregate) | wallet_transactions |

## Routes Still Depending on Legacy Reads

**None.** All active read paths use wallet_accounts and wallet_transactions.

## processed_txn_id Deprecation

- **Status**: Can be deprecated.
- **Primary reference**: `wallet_transaction_id` is now set on all deposit and withdrawal approvals.
- **Legacy compatibility**: `processed_txn_id` is still populated for backward compatibility.
- **Recommendation**: Phase 3 can stop populating `processed_txn_id` and remove the `appendLegacyBalanceTransaction` call once any external systems no longer depend on it.

## balances / balance_transactions Read-Free

- **Active runtime paths**: Yes. No route or service reads from `balances` or `balance_transactions` in normal request handling.
- **Exceptions**:
  - `wallet-reconciliation.js` – reads legacy for reconciliation/verification only.
  - `db.js` / `db-sqlite.js` – bootstrap sync from balances to wallet_accounts on startup (one-time migration for existing data).

## Remaining Legacy Dependencies

| Component | Type | Phase 3 Action |
|-----------|------|----------------|
| `syncToLegacyBalances` | Write | Remove when legacy retired |
| `appendLegacyBalanceTransaction` | Write | Remove when processed_txn_id deprecated |
| `wallet-reconciliation.js` | Read (reconciliation) | Keep for audit; optional |
| Bootstrap sync (balances → wallet_accounts) | Read (startup) | Keep for migration; can remove after full cutover |

## Recommendation for Phase 3

1. Run reconciliation in production to confirm no drift.
2. Stop populating `processed_txn_id` (or make it optional).
3. Remove `syncToLegacyBalances` and `appendLegacyBalanceTransaction` from wallet-ledger.
4. Treat `balances` and `balance_transactions` as archive-only.
5. Improve owner/admin reporting and audit visibility on top of wallet_transactions.
