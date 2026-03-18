# Owner/Admin Panel – Financial Audit Report

## Summary

The owner/admin panel uses the **same financial source of truth** as the user-facing wallet and home screens: `wallet_accounts` and `wallet_transactions` via `server/services/wallet-service.js` → `server/services/wallet-ledger.js`. All admin money flows (deposit approval, withdrawal approval, manual adjust, owner set) go through these services. No balance-changing flow bypasses the ledger.

**Critical fix applied:** Added temporary detailed logging for every admin financial action and a post-approval balance check for deposits so any mismatch (e.g. “approved but user sees 0”) is visible in logs.

---

## 1. Audit Findings

### 1.1 Deposit approval flow

| Item | Status | Notes |
|------|--------|------|
| **Source of truth** | ✅ | `createDeposit(tx, opts)` from `wallet-service.js` → `recordTransaction` in `wallet-ledger.js`. Writes to `wallet_transactions` and updates `wallet_accounts`. |
| **Transaction scope** | ✅ | Uses `withTransaction(db, async (tx) => { ... createDeposit(tx, ...) })`. Same `tx` is used for ledger and for updating `deposit_requests`. |
| **Idempotency** | ✅ | `idempotencyKey: deposit_review_${requestId}` prevents duplicate credits. |
| **Request status** | ✅ | `deposit_requests` is updated to `approved` and `wallet_transaction_id` set only after `createDeposit` succeeds. |
| **User-facing balance** | ✅ | `GET /api/balance/overview` and `GET /api/balance/my` read from `getWalletAccountsOverview` / `getMainBalance` (wallet_accounts). Same source as admin. |
| **Possible “approved but 0” cause** | ⚠️ | If DB is not shared (e.g. read replica lag) or a bug in `getOrCreateWalletAccount`/UPDATE, balance could be wrong. Logging + post-approval balance check added to detect this. |

### 1.2 Withdrawal approval flow

| Item | Status | Notes |
|------|--------|------|
| **Source of truth** | ✅ | `createWithdrawal(tx, opts)` from wallet-service → ledger. Debits `wallet_accounts`. |
| **Transaction scope** | ✅ | Same `withTransaction` + `tx` for ledger and `withdrawal_requests` update. |
| **Idempotency** | ✅ | `withdrawal_review_${requestId}`. |
| **Sufficiency check** | ✅ | Uses `getBalanceAmount` (getMainBalance) and withdraw summary before calling `createWithdrawal`. |

### 1.3 Manual balance adjustments

| Item | Status | Notes |
|------|--------|------|
| **Adjust** (`POST /adjust`) | ✅ | Uses `adjustBalance(tx, ...)` from wallet-service; same ledger. |
| **Owner set** (`POST /set`) | ✅ | Uses `adjustBalance(tx, ...)` with delta = target - current; same ledger. |

### 1.4 Wallet/balance display in admin

| Endpoint / usage | Source | Notes |
|------------------|--------|-------|
| `GET /api/balance/admin/user-wallet?userId=` | ✅ | `getWalletAccountsOverview(db, userId)` + `getWalletHistory` + `getEarningHistory`. All from wallet_accounts / wallet_transactions. |
| `GET /api/balance/getUser` (balance by user) | ✅ | Reads from `wallet_accounts`. |
| Stats: `GET /api/stats/balanceStats` | ✅ | `getPlatformWalletTotals` from wallet-reads.js → wallet_accounts. |
| Stats: `GET /api/stats/transactionStats` | ✅ | `getTransactionStats` from wallet-reads.js → wallet_transactions. |

No admin balance display uses legacy `balances` or `balance_transactions` for the main balance.

### 1.5 Financial transaction creation

| Flow | Service | Table(s) written |
|------|---------|-------------------|
| Deposit approve | `createDeposit` | wallet_transactions, wallet_accounts |
| Withdrawal approve | `createWithdrawal` | wallet_transactions, wallet_accounts |
| Adjust / Owner set | `adjustBalance` | wallet_transactions, wallet_accounts |

All go through `wallet-service.js` → `wallet-ledger.js`. No duplicate or legacy write paths for these actions.

### 1.6 Mapping admin actions → financial system

| Admin action | API | Service call | Ledger idempotency |
|--------------|-----|--------------|--------------------|
| Approve deposit | `POST /api/balance/admin/deposit-requests/:id/review` | `createDeposit` | `deposit_review_{id}` |
| Reject deposit | Same | None (status → rejected) | N/A |
| Approve withdrawal | `POST /api/balance/admin/withdrawal-requests/:id/review` | `createWithdrawal` | `withdrawal_review_{id}` |
| Reject withdrawal | Same | None | N/A |
| Complete withdrawal | `POST .../withdrawal-requests/:id/complete` | None (status only) | N/A |
| Adjust balance | `POST /api/balance/adjust` | `adjustBalance` | `adjust_{userId}_{currency}_{ts}` |
| Owner set balance | `POST /api/balance/set` | `adjustBalance` | `owner_set_*` |

### 1.7 Legacy / old services and tables

| Component | Status |
|-----------|--------|
| **balances** | Legacy; not written by deposit/withdraw/adjust/set. Dual-write was removed; wallet_accounts is source of truth. |
| **balance_transactions** | Legacy; not used by admin financial flows. |
| **processed_txn_id** | Dropped from deposit_requests / withdrawal_requests. Only `wallet_transaction_id` is used. |
| **wallet-service / wallet-ledger** | Current; only entry point for balance-changing operations. |

Admin panel does not call any legacy balance write path.

### 1.8 Mismatch admin vs user-facing data source

There is **no** mismatch: both use the same APIs and services.

- User wallet / home total assets: `GET /api/balance/overview` → `getWalletAccountsOverview(db, req.user.id)`.
- Admin user wallet: `GET /api/balance/admin/user-wallet` → same `getWalletAccountsOverview(db, userId)`.

Same DB, same tables (`wallet_accounts`, `wallet_transactions`).

### 1.9 Transaction safety and rollback

| Item | Status |
|------|--------|
| Deposit/withdraw/adjust/set | All run inside `withTransaction(db, fn)`. On error, ROLLBACK; no partial commit. |
| Duplicate approval risk | Mitigated by idempotency keys and by updating request status only after successful ledger write. |
| Post-deposit balance check | Added: after `createDeposit`, compare `getBalanceAmount(tx, ...)` with `balanceAfter`; log warning if mismatch. |

### 1.10 Permissions / roles for sensitive actions

| Action | Middleware | Role / permission |
|--------|------------|-------------------|
| Deposit review | `requirePermission(db, 'deposits.manage')` | Permission-based |
| Withdrawal review | `requirePermission(db, 'withdrawals.manage')` | Permission-based |
| Adjust | `requirePermission(db, 'manage_balances')` | Permission-based |
| Owner set | `requireRole('owner')` | Owner only |
| User wallet (admin) | `requirePermission(db, 'manage_balances')` | Permission-based |

---

## 2. Broken Points Identified

1. **No structured logging for admin financial actions**  
   - **Fix:** Added `logAdminFinancialAction()` and called it for deposit approve, withdrawal approve, adjust, owner set. Logs: admin_user_id, target_user_id, action_type, source_table, target_table, transaction_id, balance_before, balance_after, and extra (e.g. requestId, amount).

2. **No post-approval check for deposit**  
   - If ledger write succeeded but something else was wrong, “approved but 0” could occur.  
   - **Fix:** After `createDeposit`, we call `getBalanceAmount(tx, ...)` and compare with `balanceAfter`; if they differ, log a warning `[admin-financial] deposit approval balance mismatch`.

3. **Audit metadata lacked balance snapshot**  
   - **Fix:** `createAdminAuditLog` for deposit_approved and withdrawal_approved now includes `walletTxnId`, `balanceBefore`, `balanceAfter` in metadata.

No other critical broken points were found in the flows that credit or debit user balance from the admin panel.

---

## 3. Parts Still Dependent on Legacy (Read-Only or Reporting)

- **Reconciliation** (`GET /api/balance/admin/reconcile`) and **wallet-reconciliation.js**: read from both wallet_* and legacy tables to compare; no balance changes.
- **Reporting/analytics** (e.g. owner-growth, stats): use wallet-reads.js (wallet_accounts, wallet_transactions). No legacy write.

---

## 4. Changes Made (Minimal and Safe)

| File | Change |
|------|--------|
| **server/routes/balance.js** | 1) Added `logAdminFinancialAction()`. 2) Deposit review: get balance before, call createDeposit, verify balance after, log and enrich audit metadata. 3) Withdrawal review: get balance before, call createWithdrawal, log and enrich audit metadata. 4) Adjust: get balance before, call adjustBalance, log. 5) Owner set: after adjustBalance, log. |

No change to project structure, UI, or business logic beyond logging and one verification step.

---

## 5. Temporary Log Format

Every admin financial action logs one line to stdout:

```json
{
  "admin_user_id": 1,
  "target_user_id": 42,
  "action_type": "deposit_approve",
  "source_table": "deposit_requests",
  "target_table": "wallet_accounts",
  "transaction_id": 123,
  "balance_before": 0,
  "balance_after": 100,
  "extra": { "requestId": 5, "amount": 100, "currency": "USDT" }
}
```

Action types: `deposit_approve`, `withdrawal_approve`, `balance_adjust`, `owner_set`.

---

## 6. Priority Order Addressed

1. **Deposit crediting consistency** – Same ledger path; added logging and balance verification.
2. **Withdrawal consistency** – Same ledger path; added logging.
3. **Correct wallet balance display** – Already using wallet_accounts; no change.
4. **Admin-to-financial-system integration** – Confirmed single path; documented and logged.
5. **Legacy cleanup** – No new legacy removal in this pass; audit confirms admin does not use legacy for writes.

---

## 7. Recommendation if “Approved but 0” Still Occurs

1. Search logs for `[admin-financial]` and `deposit approval balance mismatch` for the affected user and request.
2. If balance mismatch is logged: investigate DB (e.g. connection pool, replica lag, or schema/constraint on `wallet_accounts`).
3. If no mismatch but user still sees 0: check that the user’s frontend calls `GET /api/balance/overview` (or equivalent) and that there is no caching or wrong user id.
4. Run `server/scripts/wallet-integrity-check.js` and reconciliation to compare wallet_accounts vs wallet_transactions and legacy tables.
