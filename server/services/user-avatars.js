import fs from 'node:fs/promises'
import path from 'node:path'
import { get, run, all } from '../db.js'
import { getUploadStorageKey, getUploadedAssetByKey, persistUploadedAsset, toStoredUploadReference } from './uploaded-assets.js'

function guessMimeType(filePath, fallback = 'image/jpeg') {
  const ext = path.extname(String(filePath || '')).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.svg') return 'image/svg+xml'
  return fallback
}

function toAbsoluteUploadPath(value) {
  const storageKey = getUploadStorageKey(value)
  if (!storageKey) return null
  return path.join(process.cwd(), 'server', 'uploads', storageKey)
}

async function readLocalFileAsBase64(absPath) {
  const fileBuffer = await fs.readFile(absPath)
  return {
    contentBase64: fileBuffer.toString('base64'),
    byteSize: fileBuffer.length,
  }
}

export function buildUserAvatarUrl(userId, avatarPath) {
  const id = Number(userId || 0)
  if (!id || !String(avatarPath || '').trim()) return null
  return `/api/profile/avatar-file/${id}`
}

export async function persistUserAvatarUpload(db, { userId, filePath, mimeType, originalName }) {
  const storedReference = toStoredUploadReference(filePath)
  if (!storedReference) throw new Error('INVALID_AVATAR_REFERENCE')
  const normalizedMimeType = String(mimeType || '').trim() || guessMimeType(filePath)
  const { contentBase64 } = await readLocalFileAsBase64(filePath)

  await persistUploadedAsset(db, {
    publicUrl: storedReference,
    absolutePath: filePath,
    mimeType: normalizedMimeType,
    originalName: originalName || path.basename(filePath),
  })

  await run(
    db,
    `UPDATE users
     SET avatar_path = ?,
         avatar_blob_base64 = ?,
         avatar_blob_mime_type = ?
     WHERE id = ?`,
    [storedReference, contentBase64, normalizedMimeType, userId],
  )

  return storedReference
}

export async function resolveUserAvatarAsset(db, userId) {
  const row = await get(
    db,
    `SELECT id, avatar_path, avatar_blob_base64, avatar_blob_mime_type
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId],
  )
  if (!row) return null

  const inlineBase64 = String(row.avatar_blob_base64 || '').trim()
  if (inlineBase64) {
    return {
      mimeType: String(row.avatar_blob_mime_type || 'image/jpeg').trim() || 'image/jpeg',
      contentBase64: inlineBase64,
    }
  }

  const storageKey = getUploadStorageKey(row.avatar_path)
  if (!storageKey) return null

  const uploadedAsset = await getUploadedAssetByKey(db, storageKey)
  if (uploadedAsset?.content_base64) {
    await run(
      db,
      `UPDATE users
       SET avatar_blob_base64 = ?, avatar_blob_mime_type = ?
       WHERE id = ?`,
      [uploadedAsset.content_base64, uploadedAsset.mime_type || 'image/jpeg', row.id],
    )
    return {
      mimeType: String(uploadedAsset.mime_type || 'image/jpeg').trim() || 'image/jpeg',
      contentBase64: String(uploadedAsset.content_base64),
    }
  }

  const absolutePath = toAbsoluteUploadPath(row.avatar_path)
  if (!absolutePath) return null
  try {
    const { contentBase64 } = await readLocalFileAsBase64(absolutePath)
    const detectedMimeType = guessMimeType(absolutePath)
    await run(
      db,
      `UPDATE users
       SET avatar_blob_base64 = ?, avatar_blob_mime_type = ?
       WHERE id = ?`,
      [contentBase64, detectedMimeType, row.id],
    )
    return {
      mimeType: detectedMimeType,
      contentBase64,
    }
  } catch {
    return null
  }
}

export async function backfillUserAvatarBlobs(db) {
  const rows = await all(
    db,
    `SELECT id
     FROM users
     WHERE avatar_path IS NOT NULL
       AND avatar_path <> ''
       AND (avatar_blob_base64 IS NULL OR avatar_blob_base64 = '')`,
  )

  let backfilled = 0
  let missing = 0
  for (const row of rows) {
    const asset = await resolveUserAvatarAsset(db, row.id)
    if (asset?.contentBase64) backfilled += 1
    else missing += 1
  }
  return { backfilled, missing }
}
