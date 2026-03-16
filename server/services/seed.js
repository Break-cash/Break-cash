import { all, get, run } from '../db.js'
import { hashPassword } from '../auth.js'
import { getUniqueReferralCode } from '../routes/auth.js'

export async function ensureBaseSeed(db) {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@excorex.local'
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdmMin@123456'
  const ownerEmail = process.env.OWNER_EMAIL || 'owner@breakcash.com'
  const ownerPassword = process.env.OWNER_PASSWORD || 'Mohep1@22'

  const existingAdmin = await get(db, `SELECT id FROM users WHERE email = ? LIMIT 1`, [adminEmail])
  if (!existingAdmin) {
    const passwordHash = await hashPassword(adminPassword)
    await run(
      db,
      `INSERT INTO users (
        email, phone, password_hash, role, is_approved, is_banned,
        verification_status, blue_badge, vip_level
      ) VALUES (?, NULL, ?, 'admin', 1, 0, 'verified', 0, 0)`,
      [adminEmail, passwordHash],
    )
  }

  const existingOwner = await get(db, `SELECT id FROM users WHERE email = ? LIMIT 1`, [ownerEmail])
  if (!existingOwner) {
    const ownerPasswordHash = await hashPassword(ownerPassword)
    await run(
      db,
      `INSERT INTO users (
        email, phone, password_hash, role, is_approved, is_banned,
        verification_status, blue_badge, vip_level
      ) VALUES (?, NULL, ?, 'owner', 1, 0, 'verified', 1, 5)`,
      [ownerEmail, ownerPasswordHash],
    )
  }

  const walletLink = process.env.DEFAULT_WALLET_LINK || 'https://wallet.example.com'
  const setting = await get(db, `SELECT id FROM settings WHERE key = 'wallet_link' LIMIT 1`)
  if (!setting) {
    await run(db, `INSERT INTO settings (key, value) VALUES ('wallet_link', ?)`, [walletLink])
  }

  await backfillReferralCodes(db)
}

/** إضافة رابط وكود الإحالة للحسابات القديمة التي لا تملكه */
async function backfillReferralCodes(db) {
  const usersWithoutCode = await all(
    db,
    `SELECT id FROM users WHERE referral_code IS NULL OR TRIM(COALESCE(referral_code, '')) = '' ORDER BY id`,
    [],
  )
  if (usersWithoutCode.length === 0) return
  let updated = 0
  for (const row of usersWithoutCode) {
    const userId = Number(row.id)
    if (!userId) continue
    try {
      const code = await getUniqueReferralCode(db)
      await run(db, `UPDATE users SET referral_code = ? WHERE id = ?`, [code, userId])
      updated += 1
    } catch (err) {
      console.warn(`[seed] Failed to backfill referral code for user ${userId}:`, err?.message || err)
    }
  }
  if (updated > 0) {
    console.log(`[seed] Backfilled referral codes for ${updated} user(s)`)
  }
}
