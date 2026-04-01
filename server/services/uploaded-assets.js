import fs from 'node:fs/promises'
import path from 'node:path'
import { get, run } from '../db.js'
import { isObjectStorageConfigured, putObjectFromBuffer } from './object-storage.js'

function normalizeStorageKey(value) {
  const raw = String(value || '').split('?')[0].trim().replaceAll('\\', '/')
  if (!raw) return null
  const withoutOrigin = raw.replace(/^https?:\/\/[^/]+/i, '')
  const prefixed = withoutOrigin.replace(/^\/+/, '')
  if (prefixed.startsWith('uploads/')) {
    return prefixed.slice('uploads/'.length)
  }
  const uploadsIndex = prefixed.toLowerCase().lastIndexOf('/uploads/')
  if (uploadsIndex >= 0) {
    return prefixed.slice(uploadsIndex + '/uploads/'.length)
  }
  const absoluteUploadsIndex = prefixed.toLowerCase().lastIndexOf('uploads/')
  if (absoluteUploadsIndex >= 0) {
    return prefixed.slice(absoluteUploadsIndex + 'uploads/'.length)
  }
  return null
}

export function toUploadPublicUrl(value, options = {}) {
  const storageKey = normalizeStorageKey(value)
  if (!storageKey) return String(value || '').trim() || null
  const baseUrl = `/uploads/${storageKey}`
  const withVersion = options.withVersion !== false
  if (!withVersion) return baseUrl
  const version = path.basename(storageKey).replace(/[^a-zA-Z0-9._-]/g, '')
  return version ? `${baseUrl}?v=${encodeURIComponent(version)}` : baseUrl
}

export function getUploadStorageKey(value) {
  return normalizeStorageKey(value)
}

export function toStoredUploadReference(value) {
  const storageKey = normalizeStorageKey(value)
  return storageKey ? `/uploads/${storageKey}` : String(value || '').trim() || null
}

export async function persistUploadedAsset(db, payload) {
  const storageKey = normalizeStorageKey(payload?.publicUrl)
  const absolutePath = String(payload?.absolutePath || '').trim()
  if (!storageKey || !absolutePath) return null
  const fileBuffer = await fs.readFile(absolutePath)
  const mimeType = String(payload?.mimeType || 'application/octet-stream').trim() || 'application/octet-stream'
  const originalName = String(payload?.originalName || path.basename(absolutePath)).trim() || path.basename(absolutePath)

  let contentBase64 = fileBuffer.toString('base64')
  let externalUrl = null
  if (isObjectStorageConfigured()) {
    try {
      const published = await putObjectFromBuffer(storageKey, fileBuffer, mimeType)
      if (published) {
        externalUrl = published
        contentBase64 = ''
      }
    } catch (e) {
      console.warn('[uploads] object storage upload failed, falling back to DB blob', e instanceof Error ? e.message : String(e))
    }
  }

  await run(
    db,
    `INSERT INTO uploaded_assets (storage_key, mime_type, original_name, content_base64, byte_size, external_url)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(storage_key) DO UPDATE SET
       mime_type = excluded.mime_type,
       original_name = excluded.original_name,
       content_base64 = excluded.content_base64,
       byte_size = excluded.byte_size,
       external_url = excluded.external_url,
       updated_at = CURRENT_TIMESTAMP`,
    [storageKey, mimeType, originalName, contentBase64, fileBuffer.length, externalUrl],
  )
  return {
    storageKey,
    mimeType,
    originalName,
    byteSize: fileBuffer.length,
    externalUrl,
  }
}

export async function getUploadedAssetByKey(db, storageKey) {
  const key = normalizeStorageKey(storageKey)
  if (!key) return null
  return get(
    db,
    `SELECT storage_key, mime_type, original_name, content_base64, byte_size, external_url, updated_at
     FROM uploaded_assets
     WHERE storage_key = ?
     LIMIT 1`,
    [key],
  )
}
