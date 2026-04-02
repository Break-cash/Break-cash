import { all, run } from '../db.js'

/**
 * Append-only audit trail for KYC/support uploads, retention runs, and policy changes.
 * actor_user_id may be null for automated jobs.
 */
export async function logSensitiveAssetAudit(db, payload) {
  const {
    actorUserId = null,
    subjectUserId = null,
    resourceType,
    resourceId = null,
    action,
    metadata = {},
    ipAddress = null,
  } = payload || {}
  await run(
    db,
    `INSERT INTO sensitive_asset_audit_log (actor_user_id, subject_user_id, resource_type, resource_id, action, metadata, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      actorUserId,
      subjectUserId,
      String(resourceType || '').slice(0, 120),
      resourceId != null ? String(resourceId).slice(0, 200) : null,
      String(action || '').slice(0, 120),
      JSON.stringify(metadata && typeof metadata === 'object' ? metadata : { value: metadata }),
      ipAddress ? String(ipAddress).slice(0, 120) : null,
    ],
  )
}

export async function listSensitiveAssetAudit(db, { limit = 100, offset = 0 } = {}) {
  const lim = Math.min(500, Math.max(1, Number(limit) || 100))
  const off = Math.max(0, Number(offset) || 0)
  return all(
    db,
    `SELECT id, actor_user_id, subject_user_id, resource_type, resource_id, action, metadata, ip_address, created_at
     FROM sensitive_asset_audit_log
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [lim, off],
  )
}
