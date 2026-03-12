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

  const delayMinutes = randomMinutes(60)
  await run(
    db,
    `UPDATE users
     SET verification_status = 'pending',
         verification_ready_at = datetime('now', ?)
     WHERE id = ?`,
    [`+${delayMinutes} minutes`, userId],
  )
  return delayMinutes
}

export async function refreshVerificationStatus(db, userId) {
  const user = await get(
    db,
    `SELECT id, verification_status, verification_ready_at, blue_badge
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
    }
  }
}

