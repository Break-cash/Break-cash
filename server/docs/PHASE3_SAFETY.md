# Phase 3: Production/Staging Reconciliation & Safety Notes

**Read this before deploying Phase 3.**

## Pre-Cutover Checklist

### 1. Run Reconciliation in Production/Staging

Before disabling legacy sync, run the integrity check against your production database:

```bash
# Set DATABASE_URL to production/staging connection string
DATABASE_URL="postgresql://..." npm run wallet:integrity
```

Or use the admin API (owner-only):

```
GET /api/balance/admin/reconcile
GET /api/balance/admin/reconcile?userId=123&currency=USDT
```

**Expected**: Zero discrepancies. If any exist, investigate before Phase 3.

### 2. Verify Wallet Coverage

Ensure all users with non-zero balances have `wallet_accounts` rows:

- Bootstrap sync in `db.js` / `db-sqlite.js` runs on startup and copies from `balances` → `wallet_accounts`
- If a user has `balances` but no `wallet_accounts`, they will see 0 balance after Phase 3
- Run reconciliation to detect such cases

### 3. Backup

- Take a database backup before deploying Phase 3
- Keep `balances` and `balance_transactions` tables; do not drop them yet

### 4. Rollback Option

If issues arise, set in environment:

```
LEGACY_SYNC_ENABLED=1
```

This re-enables writes to legacy tables until the next deployment. Requires code that checks this flag (Phase 3A adds it).

---

## Phase 3A: What Changes

| Change | Risk | Mitigation |
|--------|------|-------------|
| Stop writing to `balances` | Low | Wallet is source of truth; legacy was sync only |
| Stop writing to `balance_transactions` | Low | `processed_txn_id` becomes null; `wallet_transaction_id` is primary |
| `processed_txn_id` = null for new requests | Low | No active code reads it; external systems may need update |

---

## Phase 3B: Future Actions (Do Not Execute Yet)

- **processed_txn_id**: Can be removed from schema in a future migration after confirming no external dependencies
- **balances / balance_transactions**: Archive (read-only) or drop in a later phase after extended observation
- **Dead code**: `syncToLegacyBalances` and `appendLegacyBalanceTransaction` can be removed once Phase 3A is stable

---

## Monitoring After Deploy

1. Watch for `[wallet] Missing wallet_accounts` logs – indicates users with no wallet row
2. Run `npm run wallet:integrity` periodically
3. Check `GET /api/balance/admin/reconcile` for any new discrepancies (legacy will drift from wallet after sync stops; that is expected)
