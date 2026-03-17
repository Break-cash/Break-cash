#!/usr/bin/env node
/**
 * Wallet integrity check script.
 * Run: node server/scripts/wallet-integrity-check.js
 * Requires: USE_SQLITE=1 or DATABASE_URL for PostgreSQL
 *
 * Phase 1: Integrity verification for wallet architecture.
 */
import 'dotenv/config'
import { openDb } from '../db.js'
import {
  reconcileUserCurrency,
  reconcileAll,
  verifyEarningTransfers,
} from '../services/wallet-reconciliation.js'

async function main() {
  const db = await openDb()
  console.log('=== Wallet Integrity Check ===\n')

  // 1. Reconcile all
  console.log('1. Reconciling wallet_accounts vs balances vs ledger sum...')
  const discrepancies = await reconcileAll(db, 200)
  if (discrepancies.length === 0) {
    console.log('   OK: No discrepancies found.')
  } else {
    console.log(`   WARN: ${discrepancies.length} discrepancy(ies):`)
    discrepancies.slice(0, 10).forEach((d) => {
      console.log(`   - User ${d.userId} ${d.currency}: ${d.message}`)
    })
    if (discrepancies.length > 10) {
      console.log(`   ... and ${discrepancies.length - 10} more`)
    }
  }

  // 2. Earning transfers
  console.log('\n2. Verifying earning_entries → wallet_transactions...')
  const earningCheck = await verifyEarningTransfers(db, 100)
  console.log(`   Checked ${earningCheck.checked} transferred earnings.`)
  if (earningCheck.issues.length === 0) {
    console.log('   OK: All transferred earnings have valid wallet_transaction.')
  } else {
    console.log(`   WARN: ${earningCheck.issues.length} issue(s):`)
    earningCheck.issues.forEach((i) => console.log(`   - ${JSON.stringify(i)}`))
  }

  console.log('\n=== Done ===')
  process.exit(discrepancies.length > 0 || earningCheck.issues.length > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Integrity check failed:', err)
  process.exit(1)
})
