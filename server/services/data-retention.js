import fs from 'node:fs/promises'
import path from 'node:path'
import { all, get, run } from '../db.js'
import { getUploadStorageKey } from './uploaded-assets.js'
import { logSensitiveAssetAudit } from './sensitive-asset-audit.js'
import { getUploadsRoot } from './uploads-root.js'
import { deleteObjectByStorageKey } from './object-storage.js'

function clampInt(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.floor(n)))
}

async function ensureSettingsRow(db) {
  let row = await get(db, `SELECT * FROM data_retention_settings WHERE id = 1 LIMIT 1`, [])
  if (!row) {
    await run(
      db,
      `INSERT INTO data_retention_settings (id, kyc_rejected_retention_days, kyc_approved_retention_days, support_closed_attachment_retention_days, auto_purge_enabled)
       VALUES (1, 730, 0, 1095, 0)`,
      [],
    )
    row = await get(db, `SELECT * FROM data_retention_settings WHERE id = 1 LIMIT 1`, [])
  }
  return row
}

export async function getRetentionSettings(db) {
  const row = await ensureSettingsRow(db)
  if (!row) {
    return {
      kyc_rejected_retention_days: 730,
      kyc_approved_retention_days: 0,
      support_closed_attachment_retention_days: 1095,
      auto_purge_enabled: 0,
      last_purge_run_at: null,
      last_purge_summary: null,
      updated_at: null,
      updated_by: null,
    }
  }
  return {
    kyc_rejected_retention_days: Number(row.kyc_rejected_retention_days ?? 730),
    kyc_approved_retention_days: Number(row.kyc_approved_retention_days ?? 0),
    support_closed_attachment_retention_days: Number(row.support_closed_attachment_retention_days ?? 1095),
    auto_purge_enabled: Number(row.auto_purge_enabled ?? 0),
    last_purge_run_at: row.last_purge_run_at || null,
    last_purge_summary: row.last_purge_summary || null,
    updated_at: row.updated_at || null,
    updated_by: row.updated_by == null ? null : Number(row.updated_by),
  }
}

export async function updateRetentionSettings(db, actorUserId, body) {
  const current = await getRetentionSettings(db)
  const next = {
    kyc_rejected_retention_days: clampInt(body?.kyc_rejected_retention_days, 30, 3650, current.kyc_rejected_retention_days),
    kyc_approved_retention_days: clampInt(body?.kyc_approved_retention_days, 0, 36500, current.kyc_approved_retention_days),
    support_closed_attachment_retention_days: clampInt(
      body?.support_closed_attachment_retention_days,
      30,
      3650,
      current.support_closed_attachment_retention_days,
    ),
    auto_purge_enabled: Number(body?.auto_purge_enabled) === 1 ? 1 : 0,
  }

  await run(
    db,
    `UPDATE data_retention_settings
     SET kyc_rejected_retention_days = ?,
         kyc_approved_retention_days = ?,
         support_closed_attachment_retention_days = ?,
         auto_purge_enabled = ?,
         updated_at = CURRENT_TIMESTAMP,
         updated_by = ?
     WHERE id = 1`,
    [
      next.kyc_rejected_retention_days,
      next.kyc_approved_retention_days,
      next.support_closed_attachment_retention_days,
      next.auto_purge_enabled,
      actorUserId,
    ],
  )

  await logSensitiveAssetAudit(db, {
    actorUserId,
    resourceType: 'retention',
    resourceId: 'settings',
    action: 'policy_update',
    metadata: { before: current, after: next },
  })

  return getRetentionSettings(db)
}

function cutoffIso(days) {
  const d = Math.max(1, Number(days) || 1)
  return new Date(Date.now() - d * 86400000).toISOString()
}

async function deleteDiskAndDbAsset(db, publicUrl) {
  const key = getUploadStorageKey(String(publicUrl || ''))
  if (key) {
    await deleteObjectByStorageKey(key)
    const abs = path.join(getUploadsRoot(), key)
    try {
      await fs.unlink(abs)
    } catch (e) {
      if (e && e.code !== 'ENOENT') throw e
    }
    await run(db, `DELETE FROM uploaded_assets WHERE storage_key = ?`, [key])
  }
}

export async function previewRetentionPurge(db) {
  const s = await getRetentionSettings(db)
  const rejectedCutoff = cutoffIso(s.kyc_rejected_retention_days)
  const approvedCutoff =
    s.kyc_approved_retention_days > 0 ? cutoffIso(s.kyc_approved_retention_days) : null
  const supportCutoff = cutoffIso(s.support_closed_attachment_retention_days)

  const kycRejected = await all(
    db,
    `SELECT COUNT(*) AS c FROM kyc_submissions
     WHERE review_status = 'rejected'
       AND purged_at IS NULL
       AND COALESCE(reviewed_at, created_at) < ?`,
    [rejectedCutoff],
  )

  let kycApprovedCount = [{ c: 0 }]
  if (approvedCutoff) {
    kycApprovedCount = await all(
      db,
      `SELECT COUNT(*) AS c FROM kyc_submissions
       WHERE review_status = 'approved'
         AND purged_at IS NULL
         AND COALESCE(reviewed_at, created_at) < ?`,
      [approvedCutoff],
    )
  }

  const supportRows = await all(
    db,
    `SELECT COUNT(*) AS c
     FROM support_message_attachments sma
     INNER JOIN support_messages sm ON sm.id = sma.message_id
     INNER JOIN support_tickets st ON st.id = sm.ticket_id
     WHERE st.status IN ('resolved', 'closed')
       AND sm.created_at < ?`,
    [supportCutoff],
  )

  return {
    settings: s,
    cutoffs: { rejectedCutoff, approvedCutoff, supportCutoff },
    counts: {
      kyc_rejected: Number(kycRejected[0]?.c || 0),
      kyc_approved: Number(kycApprovedCount[0]?.c || 0),
      support_attachments: Number(supportRows[0]?.c || 0),
    },
  }
}

/**
 * Purges binary data for eligible records. KYC rows are kept with purged_at set (audit).
 */
export async function runRetentionPurge(db, { dryRun = false, actorUserId = null } = {}) {
  const s = await getRetentionSettings(db)
  const summary = {
    dryRun,
    kyc_purged: 0,
    support_attachments_removed: 0,
    errors: [],
  }

  const rejectedCutoff = cutoffIso(s.kyc_rejected_retention_days)
  const approvedCutoff =
    s.kyc_approved_retention_days > 0 ? cutoffIso(s.kyc_approved_retention_days) : null
  const supportCutoff = cutoffIso(s.support_closed_attachment_retention_days)

  const kycParams = [rejectedCutoff]
  let kycExtra = ''
  if (approvedCutoff) {
    kycExtra = ` OR (review_status = 'approved' AND COALESCE(reviewed_at, created_at) < ?)`
    kycParams.push(approvedCutoff)
  }
  const kycCandidates = await all(
    db,
    `SELECT id, user_id, id_document_path, selfie_path, review_status, reviewed_at, created_at
     FROM kyc_submissions
     WHERE purged_at IS NULL
       AND (
         (review_status = 'rejected' AND COALESCE(reviewed_at, created_at) < ?)
         ${kycExtra}
       )`,
    kycParams,
  )

  const supportCandidates = await all(
    db,
    `SELECT sma.id, sma.file_url, sma.message_id, sm.ticket_id, st.user_id AS ticket_user_id
     FROM support_message_attachments sma
     INNER JOIN support_messages sm ON sm.id = sma.message_id
     INNER JOIN support_tickets st ON st.id = sm.ticket_id
     WHERE st.status IN ('resolved', 'closed')
       AND sm.created_at < ?`,
    [supportCutoff],
  )

  if (dryRun) {
    summary.kyc_purged = kycCandidates.length
    summary.support_attachments_removed = supportCandidates.length
    await logSensitiveAssetAudit(db, {
      actorUserId,
      resourceType: 'retention',
      resourceId: 'purge',
      action: 'dry_run',
      metadata: { summary, rejectedCutoff, approvedCutoff, supportCutoff },
    })
    return summary
  }

  for (const row of kycCandidates) {
    try {
      const idDoc = String(row.id_document_path || '').trim()
      const selfie = String(row.selfie_path || '').trim()
      if (idDoc) await deleteDiskAndDbAsset(db, idDoc)
      if (selfie) await deleteDiskAndDbAsset(db, selfie)
      await run(
        db,
        `UPDATE kyc_submissions
         SET id_document_path = '', selfie_path = '',
             purged_at = CURRENT_TIMESTAMP, purged_reason = 'retention_policy'
         WHERE id = ?`,
        [row.id],
      )
      summary.kyc_purged += 1
      await logSensitiveAssetAudit(db, {
        actorUserId,
        subjectUserId: Number(row.user_id || 0) || null,
        resourceType: 'kyc_submission',
        resourceId: String(row.id),
        action: 'purged',
        metadata: { review_status: row.review_status, reason: 'retention_policy' },
      })
    } catch (e) {
      summary.errors.push({ kyc_id: row.id, message: e instanceof Error ? e.message : String(e) })
    }
  }

  for (const row of supportCandidates) {
    try {
      await deleteDiskAndDbAsset(db, row.file_url)
      await run(db, `DELETE FROM support_message_attachments WHERE id = ?`, [row.id])
      summary.support_attachments_removed += 1
      await logSensitiveAssetAudit(db, {
        actorUserId,
        subjectUserId: Number(row.ticket_user_id || 0) || null,
        resourceType: 'support_attachment',
        resourceId: String(row.id),
        action: 'purged',
        metadata: { ticket_id: row.ticket_id, message_id: row.message_id },
      })
    } catch (e) {
      summary.errors.push({ support_attachment_id: row.id, message: e instanceof Error ? e.message : String(e) })
    }
  }

  const summaryJson = JSON.stringify(summary)
  await run(
    db,
    `UPDATE data_retention_settings
     SET last_purge_run_at = CURRENT_TIMESTAMP, last_purge_summary = ?
     WHERE id = 1`,
    [summaryJson.slice(0, 8000)],
  )

  await logSensitiveAssetAudit(db, {
    actorUserId,
    resourceType: 'retention',
    resourceId: 'purge',
    action: 'completed',
    metadata: summary,
  })

  return summary
}

export async function maybeAutoRetentionPurge(db) {
  const s = await getRetentionSettings(db)
  if (!s.auto_purge_enabled) return null
  return runRetentionPurge(db, { dryRun: false, actorUserId: null })
}
