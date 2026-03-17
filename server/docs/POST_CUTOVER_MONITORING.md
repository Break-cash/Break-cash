# Post-Cutover Monitoring & Hardening

## 1. Deployment Checklist for Production

Complete **before** deploying Phase 3 to production:

- [ ] **Database backup** – Full backup of production DB (including `wallet_accounts`, `wallet_transactions`, `earning_entries`, `balances`, `balance_transactions`)
- [ ] **Pre-deploy reconciliation** – Run `npm run wallet:integrity` against production DB; expect zero discrepancies
- [ ] **Environment** – Confirm `DATABASE_URL` is set; `LEGACY_SYNC_ENABLED` is **not** set (or `0`)
- [ ] **Bootstrap sync** – Ensure app has run at least once so `wallet_accounts` is populated from `balances` for existing users
- [ ] **Health check** – Verify `GET /api/health/live` and `GET /api/health/ready` respond
- [ ] **Rollback plan** – Know how to set `LEGACY_SYNC_ENABLED=1` and redeploy if needed
- [ ] **Deploy during low traffic** – Prefer a maintenance window or low-activity period

---

## 2. Post-Deploy Monitoring (First 24–48 Hours)

### Hour 0–2

| Check | How | Expected |
|-------|-----|----------|
| App starts | Logs show `[wallet] Legacy sync to balances/balance_transactions: DISABLED (Phase 3)` | Present |
| No startup errors | Check logs for DB/schema errors | None |
| Health endpoints | `GET /api/health/live`, `GET /api/health/ready` | 200 OK |

### Hour 2–24

| Check | How | Expected |
|-------|-----|----------|
| No `[wallet] Missing wallet_accounts` | Search logs | Zero or very few (new users only) |
| No `[wallet-reconciliation] Integrity mismatch` | Search logs (if reconcile API called) | Zero |
| Deposit flow | Create test deposit (staging) or monitor real deposit | `wallet_transaction_id` set, balance updates |
| Withdrawal flow | Create test withdrawal or monitor real withdrawal | `wallet_transaction_id` set, balance debits |
| Balance reads | `GET /api/balance/my` for active users | Non-zero where expected |

### Hour 24–48

| Check | How | Expected |
|-------|-----|----------|
| Integrity script | `DATABASE_URL=... npm run wallet:integrity` | Exit 0, no discrepancies |
| Admin reconcile | `GET /api/balance/admin/reconcile` (owner) | `totalDiscrepancies: 0` (legacy drift OK after cutover) |
| Earning transfers | Integrity script step 2 | All transferred earnings have valid `wallet_transaction` |

---

## 3. Logging Review Points

### 3.1 Missing wallet_accounts

| Log pattern | Location | Action |
|-------------|----------|--------|
| `[wallet] Missing wallet_accounts row for user=X currency=Y` | `wallet-ledger.js` → `getMainBalance` | Investigate: user may have legacy balance but no wallet row. Run bootstrap sync or manual backfill. |

**Review**: Search logs for `Missing wallet_accounts`. In production, any occurrence should be reviewed. New users with no transactions may not have a row yet—that is expected on first balance read; `getOrCreateWalletAccount` will create it on first transaction.

### 3.2 Integrity Mismatches

| Log pattern | Location | Action |
|-------------|----------|--------|
| `[wallet-reconciliation] Integrity mismatch user=X currency=Y` | `wallet-reconciliation.js` → `reconcileUserCurrency` | Investigate: wallet vs ledger or wallet vs legacy drift. Run full reconciliation. |

**Review**: Triggered when `GET /api/balance/admin/reconcile` runs or integrity script runs. Check `message` for `legacy drift` vs `ledger sum mismatch`.

### 3.3 Failed Earning Transfers

| Log pattern | Location | Action |
|-------------|----------|--------|
| `[wallet-reconciliation] Failed earning transfers: N issue(s)` | `verifyEarningTransfers` | Earning entry has no matching wallet_transaction or amount mismatch. |

**Review**: Integrity script step 2; `GET /api/balance/admin/reconcile` includes `earningTransferCheck`. Logs when issues found.

### 3.4 Failed Deposit/Withdrawal Linkage

| Log pattern | Location | Action |
|-------------|----------|--------|
| `[wallet-reconciliation] Failed deposit/withdrawal linkage: N request(s) missing wallet_transaction_id` | `verifyDepositWithdrawalLinkage` | Approved/completed request has no wallet_transaction_id (pre-Phase-2 or bug). |

**Review**: Integrity script step 3; `GET /api/balance/admin/reconcile` includes `depositWithdrawalLinkage`. Pre-cutover data may have null; post-cutover should be zero.

### 3.5 Unexpected Zero Balances

| Log pattern | Location | Action |
|-------------|----------|--------|
| `[wallet-reconciliation] Unexpected zero/mismatch: N user(s)` | `verifyUnexpectedZeroBalances` | Ledger sum ≠ wallet_accounts balance. |

**Review**: Integrity script step 4; `GET /api/balance/admin/reconcile` includes `unexpectedZeroBalances`. Indicates ledger/wallet desync.

---

## 4. Admin/Operator Validation Checklist

After deployment, an admin/operator should:

### Immediate (Day 0)

1. **Health** – Confirm `/api/health/live` and `/api/health/ready` return 200.
2. **Own balance** – Log in, call `GET /api/balance/my`; balance matches expectation.
3. **Integrity script** – Run `npm run wallet:integrity` against production; exit code 0.
4. **Reconcile API** – Call `GET /api/balance/admin/reconcile` (owner); review response.

### Within 24 Hours

5. **Test deposit** (staging) – Submit deposit, approve; confirm `wallet_transaction_id` set and balance increases.
6. **Test withdrawal** (staging) – Submit withdrawal, approve; confirm `wallet_transaction_id` set and balance decreases.
7. **Log review** – Search for `[wallet]`, `[wallet-reconciliation]`; no unexpected errors.

### Within 48 Hours

8. **Sample user check** – Pick 3–5 active users; verify `wallet_accounts` balance matches `wallet_transactions` sum.
9. **Deposit/withdrawal linkage** – Run integrity script step 3 or `GET /api/balance/admin/reconcile`; `linkageIssues` should be 0 for post-cutover data.
10. **Earning transfers** – Run integrity script step 2; zero issues.
11. **Full reconcile** – `GET /api/balance/admin/reconcile` returns `summary` with all zeros.

---

## 5. When to Fully Retire Legacy

### processed_txn_id

| Condition | Timing |
|-----------|--------|
| No external systems read `processed_txn_id` | Can retire after 2 weeks of stable Phase 3 |
| All new deposit/withdrawal requests have `wallet_transaction_id` | Immediate for new data |
| Migration to drop column | After 4–6 weeks of no issues; add migration `ALTER TABLE deposit_requests DROP COLUMN processed_txn_id` (and same for withdrawal_requests) |

**Recommendation**: Retire after **4–6 weeks** of stable production with no rollbacks.

### balances

| Condition | Timing |
|-----------|--------|
| No code reads `balances` for active paths | Already true (Phase 2) |
| Bootstrap sync can be removed | After confirming all users have `wallet_accounts` |
| Table drop | After **6–12 months** as archive; keep for audit first |

**Recommendation**: Keep as **read-only archive** for 6–12 months. Drop only after legal/audit sign-off.

### balance_transactions

| Condition | Timing |
|-----------|--------|
| No code writes to it | Already true (Phase 3A) |
| No code reads it for active paths | Already true (Phase 2) |
| Reconciliation no longer needs it | When legacy drift is irrelevant |
| Table drop | Same as `balances` |

**Recommendation**: Keep as **read-only archive** for 6–12 months. Drop with `balances` after audit sign-off.

---

## 6. Best Next Product Step

### Option A: Wallet UX Improvements

**Effort**: Low–Medium | **Impact**: High

- Expose `wallet_transaction_id` in admin deposit/withdrawal UIs for traceability.
- Add transaction type filters to `GET /api/balance/history` (deposit, withdrawal, earning_credit).
- Show earning source breakdown (mining, tasks, referrals) in user dashboard.
- Add balance change notifications (e.g. push/email on deposit approval).

**When**: Anytime; improves trust and support.

### Option B: Next Earning Source Integration

**Effort**: Medium | **Impact**: High

- Architecture supports new sources via `earning_sources`, `createEarningEntry`, `transferEarningToMain`.
- Add new source (e.g. staking, ads, achievements) with minimal changes.
- Register in `earning_sources`, implement source-specific logic, call `createEarningEntry` + `transferEarningToMain`.

**When**: After 2–4 weeks of stable wallet; good time to extend value.

### Option C: Legacy Retirement Timing

**Effort**: Low | **Impact**: Operational clarity

- **4–6 weeks**: Drop `processed_txn_id` column.
- **6–12 months**: Archive `balances` and `balance_transactions` (export to cold storage), then drop tables.
- Remove `syncToLegacyBalances`, `appendLegacyBalanceTransaction`, and bootstrap sync from code.

**When**: After monitoring shows no issues; coordinate with compliance/audit.

---

## Recommended Order

1. **Now**: Deploy Phase 3, run 24–48h monitoring.
2. **Week 1–2**: Add `verifyDepositWithdrawalLinkage` and “unexpected zero balance” checks to integrity script; schedule daily runs.
3. **Week 2–4**: Wallet UX improvements (admin traceability, history filters).
4. **Week 4–6**: Retire `processed_txn_id` if stable.
5. **Month 2+**: Integrate next earning source.
6. **Month 6–12**: Plan legacy table archive and drop with audit approval.
