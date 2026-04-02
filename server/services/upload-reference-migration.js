import fs from 'node:fs/promises'
import path from 'node:path'
import { all, run } from '../db.js'
import {
  getUploadStorageKey,
  getUploadedAssetByKey,
  persistUploadedAsset,
  toStoredUploadReference,
} from './uploaded-assets.js'

async function fileExists(absPath) {
  if (!absPath) return false
  try {
    await fs.access(absPath)
    return true
  } catch {
    return false
  }
}

function toAbsoluteUploadPath(value) {
  const storageKey = getUploadStorageKey(value)
  if (!storageKey) return null
  return path.join(process.cwd(), 'server', 'uploads', storageKey)
}

async function ensureStoredUploadAsset(db, value) {
  const normalized = toStoredUploadReference(value)
  const storageKey = getUploadStorageKey(normalized)
  if (!normalized || !storageKey) return { normalized: null, exists: false }

  const existing = await getUploadedAssetByKey(db, storageKey)
  if (existing?.content_base64) {
    return { normalized, exists: true }
  }

  const absolutePath = toAbsoluteUploadPath(normalized)
  if (!(await fileExists(absolutePath))) {
    return { normalized, exists: false }
  }

  const mimeType = (() => {
    const ext = path.extname(absolutePath || '').toLowerCase()
    if (ext === '.png') return 'image/png'
    if (ext === '.webp') return 'image/webp'
    if (ext === '.gif') return 'image/gif'
    if (ext === '.svg') return 'image/svg+xml'
    return 'image/jpeg'
  })()

  await persistUploadedAsset(db, {
    publicUrl: normalized,
    absolutePath,
    mimeType,
    originalName: path.basename(absolutePath),
  })
  return { normalized, exists: true }
}

async function normalizeUserAvatarReferences(db) {
  const rows = await all(
    db,
    `SELECT id, avatar_path,
            CASE
              WHEN avatar_blob_base64 IS NOT NULL AND avatar_blob_base64 <> '' THEN 1
              ELSE 0
            END AS has_avatar_blob
     FROM users
     WHERE avatar_path IS NOT NULL
       AND avatar_path <> ''`,
  )

  let updated = 0
  let cleared = 0
  for (const row of rows) {
    const ensured = await ensureStoredUploadAsset(db, row.avatar_path)
    if (!ensured.exists) {
      if (Number(row.has_avatar_blob || 0) === 1) {
        continue
      }
      await run(db, `UPDATE users SET avatar_path = NULL WHERE id = ?`, [row.id])
      cleared += 1
      continue
    }
    if (!ensured.normalized || ensured.normalized === row.avatar_path) continue
    await run(db, `UPDATE users SET avatar_path = ? WHERE id = ?`, [ensured.normalized, row.id])
    updated += 1
  }
  return { updated, cleared }
}

async function normalizeKycReferences(db) {
  const rows = await all(
    db,
    `SELECT id, id_document_path, selfie_path
     FROM kyc_submissions
     WHERE (id_document_path IS NOT NULL AND id_document_path <> '')
        OR (selfie_path IS NOT NULL AND selfie_path <> '')`,
  )

  let updated = 0
  for (const row of rows) {
    const idDocumentPath = toStoredUploadReference(row.id_document_path)
    const selfiePath = toStoredUploadReference(row.selfie_path)
    if (
      (!idDocumentPath || idDocumentPath === row.id_document_path) &&
      (!selfiePath || selfiePath === row.selfie_path)
    ) {
      continue
    }
    await run(
      db,
      `UPDATE kyc_submissions
       SET id_document_path = ?, selfie_path = ?
       WHERE id = ?`,
      [idDocumentPath || row.id_document_path, selfiePath || row.selfie_path, row.id],
    )
    updated += 1
  }
  return updated
}

async function normalizeDepositProofReferences(db) {
  const rows = await all(
    db,
    `SELECT id, proof_image_path
     FROM deposit_requests
     WHERE proof_image_path IS NOT NULL
       AND proof_image_path <> ''`,
  )

  let updated = 0
  for (const row of rows) {
    const normalized = toStoredUploadReference(row.proof_image_path)
    if (!normalized || normalized === row.proof_image_path) continue
    await run(db, `UPDATE deposit_requests SET proof_image_path = ? WHERE id = ?`, [normalized, row.id])
    updated += 1
  }
  return updated
}

export async function migrateUploadReferences(db) {
  const avatarStats = await normalizeUserAvatarReferences(db)
  const kycUpdated = await normalizeKycReferences(db)
  const depositProofsUpdated = await normalizeDepositProofReferences(db)
  return {
    avatarsUpdated: avatarStats.updated,
    avatarsCleared: avatarStats.cleared,
    kycUpdated,
    depositProofsUpdated,
  }
}
