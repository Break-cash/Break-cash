# Wallet Ledger Migration Guide

## Overview

The new multi-source wallet architecture uses `wallet_accounts`, `wallet_transactions`, and `earning_entries` as the **source of truth** for financial operations. Legacy `balances` and `balance_transactions` are kept as a **transition layer** via dual-write for backward compatibility.

## Integrated Flows (Ledger as Source of Truth)

All balance-changing operations below now write to `wallet_transactions` first and dual-write to legacy tables.

| Flow | Route/Service | Idempotency Key | Ledger Entry |
|------|---------------|-----------------|--------------|
| **Deposit (auto-approve)** | `POST /api/balance/deposit-requests` | `deposit_auto_{requestId}` | `recordTransaction` (deposit) |
| **Deposit (admin review)** | `POST /api/balance/admin/deposit-requests/:id/review` | `deposit_review_{requestId}` | `recordTransaction` (deposit) |
| **Withdrawal (auto-approve)** | `POST /api/balance/withdrawal-requests` | `withdrawal_auto_{requestId}` | `recordTransaction` (withdrawal, negative) |
| **Withdrawal (admin review)** | `POST /api/balance/admin/withdrawal-requests/:id/review` | `withdrawal_review_{requestId}` | `recordTransaction` (withdrawal, negative) |
| **Referral reward** | `applyVipAndReferralAfterDeposit` | `referral_reward_{referralRewardId}` | `createEarningEntry` + `transferEarningToMain` |
| **Mining subscribe** | `POST /api/mining/subscribe` | `mining_subscribe_{userId}_{timestamp}` | `recordTransaction` (lock, negative) |
| **Mining daily claim** | `POST /api/mining/claim-daily` | `mining_daily_{userId}_{refId}` | `createEarningEntry` + `transferEarningToMain` |
| **Mining emergency withdraw** | `POST /api/mining/emergency-withdraw` | `mining_emergency_{userId}` | `recordTransaction` (transfer, principal - fee) |
| **Mining principal release** | `POST /api/mining/release-principal` | `mining_release_{userId}` | `recordTransaction` (unlock) |
| **Task code redeem** | `POST /api/tasks/codes/redeem` | `task_redemption_{redemptionId}` | `createEarningEntry` + `transferEarningToMain` |
| **Admin balance adjust** | `POST /api/balance/adjust` | `adjust_{userId}_{currency}_{ts}` | `recordTransaction` (adjust) |
| **Owner balance set** | `POST /api/balance/set` | `owner_set_{userId}_{currency}_{ts}` | `recordTransaction` (adjust) |
| **Admin bonus** | `POST /api/users/bonus` | `bonus_{userId}_{currency}_{ts}` | `recordTransaction` (adjust) |

## Earning Flow (Earning-First Rule)

Every generated earning is first recorded in `earning_entries` before being moved to main balance:

1. `createEarningEntry(db, { userId, sourceType, referenceType, referenceId, currency, amount })`
2. `transferEarningToMain(db, earningEntryId, idempotencyKey)` — creates `wallet_transactions` entry and updates `earning_entries.status`

## Audit-Safe History APIs

| Endpoint | Description |
|----------|-------------|
| `GET /api/balance/wallet-history?currency=USDT&limit=100` | User's wallet transaction history (from `wallet_transactions`) |
| `GET /api/balance/earning-history?sourceType=mining&limit=100` | User's earning entries history (from `earning_entries`) |

## Dual-Write (Transition Layer)

When `recordTransaction` updates `main` + `system` account:

1. `syncToLegacyBalances(db, userId, currency, balanceAfter)` — keeps `balances` in sync
2. `appendLegacyBalanceTransaction(db, payload)` — appends to `balance_transactions` for `processed_txn_id` FK on `deposit_requests` / `withdrawal_requests`

## Flows That Still Bypass the New Ledger

| Flow | Location | Notes |
|------|----------|-------|
| **Read-only balance display** | `GET /api/balance/my`, `GET /api/balance/getUser` | Reads from `balances` (synced by dual-write). Can migrate to `wallet_accounts` later. |
| **Legacy history** | `GET /api/balance/history` | Reads from `balance_transactions`. Use `wallet-history` for new audit trail. |
| **Reporting/analytics** | `owner-growth.js`, `stats.js`, `users.js` | Read from `balance_transactions` / `balances` for aggregates. Data is consistent via dual-write. |
| **Mining monthly aggregate** | `mining.js` `/my` | Reads `balance_transactions` for `mining_daily_claim` in current month. Dual-write keeps it correct. |

**No balance-changing flows bypass the ledger.** All writes go through `wallet_transactions`.

## Migration Path to Phase Out Legacy

1. **Phase 1 (current)**: Dual-write to `balances` and `balance_transactions`. `wallet_transactions` is source of truth.
2. **Phase 2**: Migrate read endpoints (`/my`, `/getUser`) to read from `wallet_accounts` when present, fallback to `balances`.
3. **Phase 3**: Backfill `wallet_accounts` for users who have `balances` but no `wallet_accounts` row (run once).
4. **Phase 4**: Remove `processed_txn_id` FK dependency by storing `wallet_transaction_id` on requests.
5. **Phase 5**: Stop dual-write to `balance_transactions`; keep `balances` sync only for legacy clients.
6. **Phase 6**: Deprecate `balances` and `balance_transactions` reads; remove dual-write.

## Idempotency Keys

All critical operations use idempotency keys to prevent duplicate execution:

- **Deposits/Withdrawals**: `{flow}_{requestId}` — one per request
- **Mining**: `mining_{action}_{userId}` or with timestamp for subscribe
- **Referral**: `referral_reward_{referralRewardId}`
- **Tasks**: `task_redemption_{redemptionId}`
- **Admin**: `{action}_{userId}_{currency}_{timestamp}` — timestamp for one-off adjustments
