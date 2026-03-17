import { get, run } from '../db.js'

export function randomMinutes(maxMinutes = 60) {
  return Math.floor(Math.random() * (maxMinutes + 1))
}

export async function scheduleVerificationIfEligible(db, userId) {
  const user = await get(
    db,
    `SELECT id, verification_status, phone_verified, identity_submitted
     FROM users WHERE id = ? LIMIT 1`,
    [userId],
  )
  if (!user) return null

  const ready = Number(user.phone_verified) === 1 && Number(user.identity_submitted) === 1
  if (!ready) return null
  if (user.verification_status === 'verified') return null

  const delayMinutes = 10 + randomMinutes(170)
  const readyAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString()
  await run(
    db,
    `UPDATE users
     SET verification_status = 'pending',
        verification_ready_at = ?
     WHERE id = ?`,
    [readyAt, userId],
  )
  return delayMinutes
}

export async function refreshVerificationStatus(db, userId) {
  const user = await get(
    db,
    `SELECT id, verification_status, verification_ready_at, blue_badge, invited_by
     FROM users WHERE id = ? LIMIT 1`,
    [userId],
  )
  if (!user) return

  if (user.verification_status === 'pending' && user.verification_ready_at) {
    const readyAtMs = Date.parse(user.verification_ready_at)
    if (!Number.isNaN(readyAtMs) && Date.now() >= readyAtMs) {
      await run(
        db,
        `UPDATE users
         SET verification_status = 'verified',
             is_approved = 1,
             verification_ready_at = NULL
         WHERE id = ?`,
        [userId],
      )
      
      // Mark as active referral if they have invited_by and made a deposit
      if (user.invited_by) {
        await markReferralAsVerifiedIfDeposited(db, userId)
      }
    }
  }
}

/**
 * Mark a referral as verified (active) if they have completed verification
 * and made at least one real deposit.
 */
export async function markReferralAsVerifiedIfDeposited(db, userId) {
  const hasDeposit = await get(
    db,
    `SELECT 1 FROM wallet_transactions
     WHERE user_id = ? AND transaction_type = 'deposit'
     LIMIT 1`,
    [userId],
  )
  
  if (hasDeposit) {
    await run(
      db,
      `UPDATE users
       SET referral_verified_at = COALESCE(referral_verified_at, CURRENT_TIMESTAMP)
       WHERE id = ? AND referral_verified_at IS NULL`,
      [userId],
    )
  }
}

