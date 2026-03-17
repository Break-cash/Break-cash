# Multi-Source Financial Architecture

## Overview

The wallet system is designed for multiple earning sources (mining, tasks, referrals, future sources) with a unified ledger and clear separation of concerns.

## Schema Summary

### 1. `earning_sources` (Registry)
Extensible registry for earning source types. Add new sources without schema changes.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| code | TEXT UNIQUE | e.g. `mining`, `tasks`, `referrals` |
| name | TEXT | Display name |
| description | TEXT | Optional |
| is_active | INTEGER | 1 = active |
| config_json | TEXT | Source-specific config |
| sort_order | INTEGER | Display order |

### 2. `wallet_accounts`
Multiple internal account types per user, per currency, per source.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| user_id | INTEGER | FK users |
| currency | TEXT | e.g. USDT |
| account_type | TEXT | `main`, `locked`, `withdrawable`, `pending` |
| source_type | TEXT | `system`, `mining`, `tasks`, `referrals`, `deposits` |
| balance_amount | DOUBLE | Current balance |
| UNIQUE(user_id, currency, account_type, source_type) | | |

**Account types:**
- `main` + `system`: Primary spendable balance
- `locked` + `mining`: Mining principal
- `locked` + `deposits`: Withdrawal-locked principal
- `withdrawable`: Computed or cached withdrawable amount

### 3. `wallet_transactions` (Unified Ledger)
Every balance-changing operation is recorded here.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| user_id | INTEGER | FK users |
| currency | TEXT | |
| transaction_type | TEXT | `deposit`, `withdrawal`, `transfer`, `earning_credit`, `lock`, `unlock`, `adjust`, `fee` |
| source_type | TEXT | `system`, `mining`, `tasks`, `referrals`, `deposits` |
| reference_type | TEXT | `deposit_request`, `withdrawal_request`, `mining_subscription`, `task_redemption`, `referral_reward`, `earning_entry`, `admin_adjust` |
| reference_id | INTEGER | ID of referenced entity |
| amount | DOUBLE | Gross amount |
| fee_amount | DOUBLE | Fee deducted |
| net_amount | DOUBLE | amount - fee_amount |
| balance_before | DOUBLE | Snapshot before |
| balance_after | DOUBLE | Snapshot after |
| account_type_before/after | TEXT | Account affected |
| metadata | TEXT | JSON metadata |
| idempotency_key | TEXT UNIQUE | Prevents duplicate processing |
| created_at | TIMESTAMP | |
| created_by | INTEGER | FK users (admin) |

### 4. `earning_entries`
Earnings generated before transfer to main balance. Supports transfer tracking.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| user_id | INTEGER | FK users |
| source_type | TEXT | `mining`, `tasks`, `referrals` |
| reference_type | TEXT | e.g. `mining_daily_claim`, `task_redemption` |
| reference_id | INTEGER | Source-specific ID |
| currency | TEXT | |
| amount | DOUBLE | |
| status | TEXT | `pending`, `transferred` |
| transferred_at | TIMESTAMP | When moved to main |
| transferred_wallet_txn_id | INTEGER | FK wallet_transactions |
| UNIQUE(source_type, reference_type, reference_id) | | Idempotency |

### 5. `mining_subscriptions`
Mining-specific lifecycle, separate from generic wallet.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| user_id | INTEGER UNIQUE | FK users |
| currency | TEXT | |
| status | TEXT | `inactive`, `active`, `cancelled_pending_release`, etc. |
| principal_amount | DOUBLE | |
| daily_percent, monthly_percent | DOUBLE | |
| emergency_fee_percent | DOUBLE | |
| started_at, ended_at | TIMESTAMP | |
| returned_principal | DOUBLE | Principal returned to user |
| penalty_amount | DOUBLE | Emergency fee taken |
| closure_reason | TEXT | Why subscription ended |
| ... | | (see mining_profiles for full field list) |

## Compatibility

- **Legacy `balances`**: Kept for backward compatibility. On schema init, existing balances are synced to `wallet_accounts` (main+system).
- **Legacy `balance_transactions`**: Remains for history. New code should use `wallet_transactions`.
- **Legacy `mining_profiles`**: Kept. `mining_subscriptions` is the new table for future use; migration path documented.

## Adding a New Earning Source

1. Insert into `earning_sources`: `INSERT INTO earning_sources (code, name, ...) VALUES ('new_source', 'New Source', ...)`
2. Create source-specific tables if needed (e.g. `new_source_entries`)
3. Use `createEarningEntry()` for pending earnings
4. Use `transferEarningToMain()` or `recordTransaction()` when crediting main balance
5. Use `recordTransaction()` with appropriate `source_type`, `reference_type`, `reference_id`

## Wallet Ledger Service

See `server/services/wallet-ledger.js`:

- `getOrCreateWalletAccount(db, userId, currency, accountType, sourceType)`
- `getMainBalance(db, userId, currency)`
- `recordTransaction(db, payload)` — idempotency via `idempotencyKey`
- `createEarningEntry(db, payload)`
- `transferEarningToMain(db, earningEntryId, idempotencyKey)`
- `getWalletHistory(db, userId, currency?, limit)`
