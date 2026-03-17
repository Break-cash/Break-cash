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
  reconcileAll,
  verifyEarningTransfers,
  verifyDepositWithdrawalLinkage,
  verifyUnexpectedZeroBalances,
} from '../services/wallet-reconciliation.js'

async function main() {
  const db = await openDb()
  console.log('=== Wallet Integrity Check ===\n')

  let hasIssues = false

  // 1. Reconcile all
  console.log('1. Reconciling wallet_accounts vs balances vs ledger sum...')
  const discrepancies = await reconcileAll(db, 200)
  if (discrepancies.length === 0) {
    console.log('   OK: No discrepancies found.')
  } else {
    hasIssues = true
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
    hasIssues = true
    console.log(`   WARN: ${earningCheck.issues.length} issue(s):`)
    earningCheck.issues.forEach((i) => console.log(`   - ${JSON.stringify(i)}`))
  }

  // 3. Deposit/withdrawal linkage
  console.log('\n3. Verifying deposit/withdrawal wallet_transaction_id linkage...')
  const linkageCheck = await verifyDepositWithdrawalLinkage(db, 200)
  const linkageCount = linkageCheck.issues.length
  if (linkageCount === 0) {
    console.log('   OK: All approved/completed requests have wallet_transaction_id.')
  } else {
    hasIssues = true
    console.log(`   WARN: ${linkageCount} request(s) missing wallet_transaction_id:`)
    linkageCheck.issues.slice(0, 10).forEach((i) => console.log(`   - ${i.type} #${i.id} user=${i.userId} amount=${i.amount}`))
    if (linkageCount > 10) console.log(`   ... and ${linkageCount - 10} more`)
  }

  // 4. Unexpected zero balances
  console.log('\n4. Verifying no ledger/wallet balance mismatch...')
  const zeroCheck = await verifyUnexpectedZeroBalances(db, 100)
  if (zeroCheck.issues.length === 0) {
    console.log(`   OK: Checked ${zeroCheck.checked} user/currency pairs, no mismatch.`)
  } else {
    hasIssues = true
    console.log(`   WARN: ${zeroCheck.issues.length} mismatch(es):`)
    zeroCheck.issues.forEach((i) => console.log(`   - User ${i.userId} ${i.currency}: ledger=${i.ledgerSum} wallet=${i.walletBalance}`))
  }

  console.log('\n=== Done ===')
  process.exit(hasIssues ? 1 : 0)
}

main().catch((err) => {
  console.error('Integrity check failed:', err)
  process.exit(1)
})
