# Wallet Ledger Migration Guide

## Overview

The new multi-source wallet architecture uses `wallet_accounts`, `wallet_transactions`, and `earning_entries` as the **source of truth** for financial operations. Legacy `balances` and `balance_transactions` are kept as a **transition layer** via dual-write for backward compatibility.

## Integrated Flows (Ledger as Source of Truth)

All balance-changing operations below now write to `wallet_transactions` first and dual-write to legacy tables.

| Flow | Service Function | Idempotency Key |
|------|------------------|-----------------|
| **Deposit (auto + admin)** | `createDeposit()` | `deposit_auto_{id}` / `deposit_review_{id}` |
| **Withdrawal (auto + admin)** | `createWithdrawal()` | `withdrawal_auto_{id}` / `withdrawal_review_{id}` |
| **Referral reward** | `createReferralReward()` | `referral_reward_{id}` |
| **Mining subscribe** | `createMiningSubscription()` | `mining_subscribe_{userId}_{ts}` |
| **Mining daily claim** | `recordMiningDailyProfit()` | `(source_type, reference_type, reference_id)` |
| **Mining emergency** | `executeMiningEmergencyWithdrawal()` | `mining_emergency_{userId}` |
| **Mining maturity** | `settleMiningAtMaturity()` | `mining_release_{userId}` |
| **Task redeem** | `createTaskReward()` | `task_redemption_{id}` |
| **Admin adjust / Owner set / Bonus** | `adjustBalance()` | `adjust_*` / `owner_set_*` / `bonus_*` |

All flows go through `server/services/wallet-service.js` → `wallet-ledger.js`.

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
| **Read-only balance** | `GET /api/balance/my`, `GET /api/balance/getUser` | Prefer `wallet_accounts` when present; fallback to `balances`. |
| **Legacy history** | `GET /api/balance/history` | Reads from `balance_transactions`. Use `wallet-history` for audit. |
| **Reporting/analytics** | `owner-growth.js`, `stats.js`, `users.js` | Read from `balance_transactions` / `balances`. Data consistent via dual-write. |
| **Mining monthly aggregate** | `mining.js` `/my` | Reads `balance_transactions` for `mining_daily_claim`. Dual-write keeps it correct. |

**No balance-changing flows bypass the ledger.** All writes go through `wallet-service.js` → `wallet_transactions`.

## Migration Path to Phase Out Legacy

1. **Phase 1** ✅: Dual-write to `balances` and `balance_transactions`. `wallet_transactions` is source of truth.
2. **Phase 2** ✅: `/my` and `/getUser` read from `wallet_accounts` when present, fallback to `balances`.
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
