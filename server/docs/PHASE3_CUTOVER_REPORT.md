# Phase 3: Full Cutover – Final Report

## Pre-Deploy: Reconciliation & Safety

**See `PHASE3_SAFETY.md`** for:
- Pre-cutover reconciliation checklist
- Backup and rollback instructions
- `LEGACY_SYNC_ENABLED=1` to re-enable legacy writes if needed

---

## Phase 3A: Completed

### 1. Wallet Architecture as Sole Runtime

Active financial runtime uses only:
- `wallet_accounts`
- `wallet_transactions`
- `earning_entries`
- `mining_subscriptions`

### 2. Legacy Writes Disabled

| Function | Status |
|----------|--------|
| `syncToLegacyBalances()` | Disabled (no-op unless `LEGACY_SYNC_ENABLED=1`) |
| `appendLegacyBalanceTransaction()` | Disabled (returns null unless `LEGACY_SYNC_ENABLED=1`) |

Legacy tables remain in the schema but are no longer written to by default.

### 3. processed_txn_id

- **Status**: Retired for new requests.
- **Behavior**: When legacy sync is disabled, `appendLegacyBalanceTransaction` returns `null`, so `processed_txn_id` is set to `null` for new deposit/withdrawal approvals.
- **Primary reference**: `wallet_transaction_id` is the only active financial reference for new requests.

### 4. Logging Added

- `getMainBalance`: Logs `[wallet] Missing wallet_accounts row` when user has no wallet row.
- `reconcileUserCurrency`: Logs `[wallet-reconciliation] Integrity mismatch` when discrepancies are found.
- Startup: Logs `[wallet] Legacy sync to balances/balance_transactions: DISABLED (Phase 3)`.

### 5. Dead Code Removed

- Removed unused `appendBalanceTransaction` wrapper and `appendLegacyBalanceTransaction` import from `balance.js`.

---

## Phase 3B: Legacy Retirement Preparation

### 1. processed_txn_id – Can It Be Fully Removed?

**Yes, with a future migration.**

- No active code reads `processed_txn_id`.
- `wallet_transaction_id` is the primary reference.
- **Recommendation**: In a later migration, add `ALTER TABLE ... DROP COLUMN processed_txn_id` after confirming no external systems depend on it.

### 2. balances and balance_transactions – Archive or Drop?

**Recommendation: Archive (keep as read-only).**

| Table | Action |
|-------|--------|
| `balances` | Keep for historical audit. No new writes. Bootstrap sync still reads once at startup. |
| `balance_transactions` | Keep for historical audit. No new writes. |

**Do not drop** until:
- Reconciliation has been run in production with no issues.
- A retention period has passed (e.g. 6–12 months).
- You have verified no external tools or reports depend on them.

### 3. Dead Code Removed

- `appendBalanceTransaction` in `balance.js` (unused wrapper).

### 4. Code Kept for Rollback

- `syncToLegacyBalances` and `appendLegacyBalanceTransaction` remain in `wallet-ledger.js` but are no-ops. Set `LEGACY_SYNC_ENABLED=1` to re-enable.

---

## Final Cutover Verification

### Any Active Path Still Writes to Legacy?

**No.** With `LEGACY_SYNC_ENABLED` unset or `0`:
- No code writes to `balances`.
- No code writes to `balance_transactions`.

### Any Active Path Still Reads Legacy (Outside Audit/Reconciliation)?

**No.** All user-facing and operational reads use:
- `wallet_accounts`
- `wallet_transactions`
- `earning_entries`

**Exceptions (audit/reconciliation only):**
- `GET /api/balance/admin/reconcile` – reads legacy for comparison.
- `wallet-reconciliation.js` – reads legacy for verification.
- Bootstrap sync – reads `balances` once at startup to populate `wallet_accounts` for existing users.

### Is the New Wallet Architecture the Only Runtime Financial System?

**Yes.** All balance changes and reads go through:
- `wallet-service.js` → `wallet-ledger.js` → `wallet_accounts` / `wallet_transactions` / `earning_entries`

Legacy tables are no longer part of the active financial flow.

---

## Files Changed in Phase 3

| File | Change |
|------|--------|
| `server/services/wallet-ledger.js` | Disabled legacy sync (env flag); added missing wallet_accounts log |
| `server/services/wallet-reconciliation.js` | Added integrity mismatch logging |
| `server/routes/balance.js` | Removed dead `appendBalanceTransaction` and import |
| `server/index.js` | Added startup log for legacy sync status |
| `server/docs/PHASE3_SAFETY.md` | **New** – reconciliation and safety notes |
| `server/docs/PHASE3_CUTOVER_REPORT.md` | **New** – this report |
