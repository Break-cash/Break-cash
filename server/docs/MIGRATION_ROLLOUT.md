# Financial System Migration Rollout Plan

## Phase 0: Financial Freeze ✅

### Completed
- **No bypass**: All balance-changing operations go through `wallet-service.js` → `wallet-ledger.js`
- **Controlled writes**: Only `syncToLegacyBalances()` and `appendLegacyBalanceTransaction()` in wallet-ledger.js write to legacy tables; both are invoked exclusively by the central service
- **Marked boundaries**: wallet-ledger.js explicitly documents "transition layer only"

### Violating Code Paths
**None.** No direct balance mutation exists outside the central wallet service.

### Phase 0 Gate
✅ **PASS** – Proceed to Phase 1

---

## Phase 1: Stabilization and Verification

### 1.1 Active Financial Flows Verification
| Flow | Uses wallet-service | Status |
|------|---------------------|--------|
| Deposits (auto + admin) | `createDeposit()` | ✅ |
| Withdrawals (auto + admin) | `createWithdrawal()` | ✅ |
| Referral rewards | `createReferralReward()` | ✅ |
| Mining subscribe | `createMiningSubscription()` | ✅ |
| Mining daily claim | `recordMiningDailyProfit()` | ✅ |
| Mining maturity | `settleMiningAtMaturity()` | ✅ |
| Mining emergency | `executeMiningEmergencyWithdrawal()` | ✅ |
| Task redeem | `createTaskReward()` | ✅ |
| Admin adjust / Owner set / Bonus | `adjustBalance()` | ✅ |

### 1.2 Reconciliation Checks
- See `server/services/wallet-reconciliation.js` (to be added)
- Compare `wallet_accounts.balance_amount` vs `balances.amount` per user/currency
- Verify `wallet_transactions` net sum matches `wallet_accounts` delta

### 1.3 Integrity Tests
- See `server/tests/wallet-integrity.test.js` (to be added)
- Deposit → balance increase
- Withdrawal → balance decrease
- Mining subscribe → lock
- Earning transfer → earning_entries status + main balance

### 1.4 Legacy Compatibility
- One-way sync: wallet_accounts → balances (via syncToLegacyBalances)
- Dual-write to balance_transactions for processed_txn_id FK only

### Phase 1 Remaining Risks
- Users with only legacy balances (no wallet_accounts) until first financial op
- Reconciliation may reveal historical drift if any pre-migration data exists

### Phase 1 Legacy Dependencies
- `deposit_requests.processed_txn_id` → balance_transactions
- `withdrawal_requests.processed_txn_id` → balance_transactions
- Read fallbacks: balances, balance_transactions for history/reporting

### Phase 1 Recommendation
Complete reconciliation service and integrity tests, then proceed to Phase 2.

---

## Phase 2: Legacy Detachment ✅

### 2.1 Stop Direct Writes to Legacy
- **Done**: Only wallet-ledger sync functions write to legacy (intentional one-way sync)
- **Done**: Added `wallet_transaction_id` to deposit_requests and withdrawal_requests

### 2.2 Migrate All Reads ✅
- **Done**: `GET /api/balance/history` uses wallet_transactions
- **Done**: users.js, owner-growth.js, stats.js use wallet_transactions/wallet_accounts
- **Done**: friends.js uses wallet_accounts
- **Done**: mining.js monthly aggregate uses wallet_transactions
- **Done**: verification.js uses wallet_transactions
- **Done**: Removed legacy fallbacks from balance /my and /getUser
- **Done**: getMainBalance no longer falls back to legacy

### 2.3 Remove/Isolate Obsolete Helpers
- `appendLegacyBalanceTransaction`: Marked LEGACY; kept for processed_txn_id compatibility
- `syncToLegacyBalances`: Marked LEGACY; Phase 3 removal
- See `LEGACY_DEPENDENCIES.md` for full list

### Phase 2 Legacy Dependencies (Post-Migration)
- Schema: balances, balance_transactions (write-only from wallet; archive)
- processed_txn_id: Can be deprecated; wallet_transaction_id is primary
- balances/balance_transactions: Read-free in active runtime paths

---

## Phase 3: Full Cutover and Expansion

### 3.1 Retire Legacy Compatibility
- Remove syncToLegacyBalances calls
- Remove appendLegacyBalanceTransaction (or make optional for audit export)
- balances/balance_transactions become archive-only

### 3.2 Sole Financial Runtime
- wallet_accounts + wallet_transactions + earning_entries = only source of truth
- All APIs return data from new architecture

### 3.3 Next Earning Source
- Add new source_type to earning_sources
- Use createEarningEntry + transferEarningToMain pattern
- No schema changes needed for new sources

### 3.4 Owner/Admin Reporting
- Wallet transaction history with filters
- Earning history by source
- Mining subscription financial trail
- Reconciliation dashboard

---

## Rollout Checklist

- [x] Phase 0: Financial freeze
- [x] Phase 1: Reconciliation + integrity tests
- [x] Phase 2: Legacy read migration
- [x] Phase 3A: Full cutover (legacy writes disabled)
- [x] Phase 3B: Legacy retirement preparation
