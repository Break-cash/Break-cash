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

## Legacy Write-Only

**REMOVED.** No code writes to `balances` or `balance_transactions`.

## Legacy Read – Reconciliation Only

| Location | Purpose |
|----------|---------|
| `wallet-reconciliation.js` | `getLegacyBalance()`, `reconcileUserCurrency()` | Compare wallet vs legacy for integrity checks |

## Bootstrap Migration

**REMOVED.** No startup sync from `balances` to `wallet_accounts`.

## Tables

| Table | Role |
|-------|------|
| `balances` | Archive-only; no runtime reads/writes |
| `balance_transactions` | Archive-only; no runtime reads/writes |
| `deposit_requests.processed_txn_id` | **DROPPED** |
| `withdrawal_requests.processed_txn_id` | **DROPPED** |
| `deposit_requests.wallet_transaction_id` | **Primary** financial reference |
| `withdrawal_requests.wallet_transaction_id` | **Primary** financial reference |
