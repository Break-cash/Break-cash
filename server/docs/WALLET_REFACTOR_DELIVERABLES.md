# Wallet Architecture Refactor – Deliverables Summary

## 1. Source of Truth Status

**wallet_accounts + wallet_transactions + earning_entries are now the true source of truth.**

| Component | Status | Notes |
|-----------|--------|------|
| `wallet_accounts` | ✅ Authoritative | Main balance read from `wallet_accounts` (main+system). `/my` and `/getUser` prefer wallet_accounts. |
| `wallet_transactions` | ✅ Authoritative | All balance-changing operations write here first. Idempotency enforced. |
| `earning_entries` | ✅ Authoritative | All earnings (mining daily, tasks, referrals) created here before transfer to main. |
| `mining_profiles` | ✅ In use | Mining state (principal, status, daily claim). `mining_subscriptions` exists in schema for future migration. |
| `balances` | ⚠️ Transition only | One-way sync from wallet_accounts. Read fallback when no wallet row. |
| `balance_transactions` | ⚠️ Transition only | Dual-write for `processed_txn_id` FK. Legacy history. |

---

## 2. Centralized Service Layer

**File:** `server/services/wallet-service.js`

All financial operations go through these functions only:

| Function | Purpose | Idempotency |
|----------|---------|-------------|
| `createDeposit()` | Credit main balance | `idempotencyKey` |
| `approveDeposit()` | Alias for createDeposit | Same |
| `createWithdrawal()` | Debit main balance | `idempotencyKey` |
| `approveWithdrawal()` | Alias for createWithdrawal | Same |
| `createMiningSubscription()` | Lock principal from main | `mining_subscribe_{userId}_{ts}` |
| `recordMiningDailyProfit()` | Earning entry + transfer to main | `(source_type, reference_type, reference_id)` |
| `transferSourceEarningsToMain()` | Transfer pending earning to main | `idempotencyKey` |
| `settleMiningAtMaturity()` | Return principal at maturity | `mining_release_{userId}` |
| `executeMiningEmergencyWithdrawal()` | Emergency withdraw with fee | `mining_emergency_{userId}` |
| `adjustBalance()` | Admin/owner adjustment | `adjust_{userId}_{currency}_{ts}` |
| `createReferralReward()` | Referral earning + transfer | `referral_reward_{id}` |
| `createTaskReward()` | Task redemption earning + transfer | `task_redemption_{id}` |

---

## 3. Flows Fully Using New Architecture

| Flow | Service Function | Route |
|------|------------------|-------|
| Deposit (auto + admin) | `createDeposit()` | `POST /api/balance/deposit-requests`, `POST /api/balance/admin/deposit-requests/:id/review` |
| Withdrawal (auto + admin) | `createWithdrawal()` | `POST /api/balance/withdrawal-requests`, `POST /api/balance/admin/withdrawal-requests/:id/review` |
| Referral reward | `createReferralReward()` | `applyVipAndReferralAfterDeposit()` |
| Mining subscribe | `createMiningSubscription()` | `POST /api/mining/subscribe` |
| Mining daily profit | `recordMiningDailyProfit()` | `POST /api/mining/claim-daily` |
| Mining maturity | `settleMiningAtMaturity()` | `POST /api/mining/release-principal` |
| Mining emergency | `executeMiningEmergencyWithdrawal()` | `POST /api/mining/emergency-withdraw` |
| Task redeem | `createTaskReward()` | `POST /api/tasks/codes/redeem` |
| Admin adjust | `adjustBalance()` | `POST /api/balance/adjust` |
| Owner set | `adjustBalance()` | `POST /api/balance/set` |
| Admin bonus | `adjustBalance()` | `POST /api/users/bonus` |

---

## 4. Validation Invariants Enforced

| Invariant | Enforcement |
|-----------|-------------|
| Principal cannot be returned twice | Idempotency `mining_release_{userId}` |
| Earning entry cannot be transferred twice | `transferEarningToMain` checks `status = 'pending'` |
| Same idempotency key cannot process twice | `recordTransaction` returns existing if key exists |
| Balances never negative | `recordTransaction` throws `INSUFFICIENT_BALANCE` |
| Closed subscriptions cannot generate earnings | Mining route checks `profile.status === 'active'` |
| Emergency cannot run after maturity | Both set `status = 'inactive'`; subsequent calls fail |
| Maturity cannot run after emergency | Same |

---

## 5. Legacy Paths Remaining

| Path | Purpose | Phase-out |
|------|---------|-----------|
| `GET /api/balance/my` | Returns `source: 'wallet_accounts'` when available, else `legacy` | Phase 2 done |
| `GET /api/balance/getUser` | Same | Phase 2 done |
| `GET /api/balance/history` | Legacy `balance_transactions` for admin view | Use `wallet-history` for audit |
| `balance_transactions` dual-write | `processed_txn_id` FK on deposit/withdrawal requests | Phase 4: add `wallet_transaction_id` |
| `balances` table | Sync from wallet_accounts; fallback read | Phase 5–6 |

**No balance-changing flows bypass the ledger.** All writes go through `wallet-service.js` → `wallet-ledger.js`.

---

## 6. File-by-File Changes

| File | Changes |
|------|---------|
| `server/services/wallet-service.js` | **NEW** – Centralized service layer with named functions |
| `server/services/wallet-ledger.js` | Unchanged – low-level ledger ops |
| `server/routes/balance.js` | Uses `createDeposit`, `createWithdrawal`, `adjustBalance`, `createReferralReward`; `/my` and `/getUser` prefer wallet_accounts |
| `server/routes/mining.js` | Uses `createMiningSubscription`, `recordMiningDailyProfit`, `settleMiningAtMaturity`, `executeMiningEmergencyWithdrawal` |
| `server/routes/tasks.js` | Uses `createTaskReward` |
| `server/routes/users.js` | Uses `adjustBalance` for bonus |
| `src/api.ts` | Added `getWalletHistory()`, `getEarningHistory()` |
| `server/docs/WALLET_MIGRATION.md` | Updated (Phase 2 complete) |
| `server/docs/WALLET_REFACTOR_DELIVERABLES.md` | **NEW** – This document |

---

## 7. Migration Risks & Follow-up

**Risks:**
- Users with only `balances` (no `wallet_accounts`) will use legacy fallback until first financial op.
- `db-sqlite.js` has sync from balances → wallet_accounts on startup for existing data.

**Follow-up:**
1. Run one-time backfill: `INSERT INTO wallet_accounts ... SELECT FROM balances` for users without wallet rows.
2. Add `wallet_transaction_id` to `deposit_requests` / `withdrawal_requests`; phase out `processed_txn_id`.
3. Update OwnerDashboardPage / AdminBalancesPage to use `getWalletHistory()` for audit view.
4. Consider removing `appendLegacyBalanceTransaction` once FK migration is done.
