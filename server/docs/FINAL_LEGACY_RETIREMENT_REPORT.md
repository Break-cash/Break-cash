# Final Legacy Retirement – Runtime-Clean Report

## 1. Any Runtime Path Still Touches Legacy?

**No.**

| Path | balances | balance_transactions |
|------|----------|----------------------|
| **Writes** | None | None |
| **Reads (active)** | None | None |
| **Reads (audit only)** | `wallet-reconciliation.js` (reconcile API, integrity script) | `wallet-reconciliation.js` (reconcile API, integrity script) |

- **Active runtime** = normal request handling (balance reads, deposits, withdrawals, mining, tasks, referrals, admin adjust).
- **Audit only** = `GET /api/balance/admin/reconcile` and `npm run wallet:integrity`; these read legacy for comparison only.

---

## 2. processed_txn_id Fully Retired?

**Yes.**

| Item | Status |
|------|--------|
| **Writes** | Removed – no code writes to `processed_txn_id` |
| **Reads** | None – no code reads it |
| **Schema** | Column dropped via migration 013 (PostgreSQL) and db-sqlite startup |
| **Balance routes** | Use only `wallet_transaction_id` |

---

## 3. balances and balance_transactions Archive-Only?

**Yes.**

| Table | Writes | Reads (active) | Reads (audit) |
|-------|--------|----------------|----------------|
| **balances** | None | None | Reconciliation only |
| **balance_transactions** | None | None | Reconciliation only |

- Bootstrap sync (balances → wallet_accounts) removed.
- No runtime code reads or writes these tables.
- Reconciliation/audit tooling may still read them for comparison.

---

## 4. Codebase Ready for Next Earning Source?

**Yes.**

| Requirement | Status |
|--------------|--------|
| Single source of truth | `wallet_accounts`, `wallet_transactions`, `earning_entries` |
| No legacy dependencies in flows | All financial flows use wallet only |
| Extensible pattern | `createEarningEntry` + `transferEarningToMain`; register in `earning_sources` |
| Idempotency | Supported via `idempotency_key` |
| Multi-source | `source_type` (mining, tasks, referrals, etc.) |

**Adding a new earning source:**
1. Add row to `earning_sources`.
2. Call `createEarningEntry` with `sourceType`, `referenceType`, `referenceId`.
3. Call `transferEarningToMain` with the earning entry id.
4. No changes to legacy or core wallet logic.

---

## Files Changed (Final Retirement)

| File | Change |
|------|--------|
| `server/routes/balance.js` | Removed `processed_txn_id` from all UPDATEs; use only `wallet_transaction_id` |
| `server/services/wallet-service.js` | Removed all `appendLegacyBalanceTransaction` calls; removed legacy from return values |
| `server/services/wallet-ledger.js` | Removed `syncToLegacyBalances`, `appendLegacyBalanceTransaction`; removed legacy sync from `recordTransaction` |
| `server/db.js` | Removed bootstrap sync; added DROP processed_txn_id |
| `server/db-sqlite.js` | Removed bootstrap sync; added DROP processed_txn_id; removed ensureDepositCol/ensureWithdrawalCol for processed_txn_id |
| `server/index.js` | Removed legacy sync startup log |
| `server/migrations/013_drop_processed_txn_id.sql` | **New** – PostgreSQL migration |

---

## Summary

| Question | Answer |
|----------|--------|
| Any runtime path still touches legacy? | **No** |
| processed_txn_id fully retired? | **Yes** |
| balances / balance_transactions archive-only? | **Yes** |
| Codebase ready for next earning source? | **Yes** |
