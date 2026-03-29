import fs from 'node:fs/promises'
import path from 'node:path'
import { all, get } from '../db.js'
import { getUploadedAssetByKey, getUploadStorageKey, persistUploadedAsset } from './uploaded-assets.js'

function toPublicUploadPath(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw)
      return url.pathname.startsWith('/uploads/') ? url.pathname : null
    } catch {
      return null
    }
  }
  if (raw.startsWith('/uploads/')) return raw
  if (path.isAbsolute(raw)) {
    const rel = path.relative(path.join(process.cwd(), 'server'), raw).replaceAll('\\', '/')
    if (rel && !rel.startsWith('..')) return `/uploads/${rel.replace(/^uploads\//, '')}`
  }
  return null
}

function toAbsoluteUploadPath(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (path.isAbsolute(raw)) return raw
  const publicPath = toPublicUploadPath(raw)
  if (!publicPath) return null
  const storageKey = getUploadStorageKey(publicPath)
  if (!storageKey) return null
  return path.join(process.cwd(), 'server', 'uploads', storageKey)
}

async function fileExists(absPath) {
  try {
    await fs.access(absPath)
    return true
  } catch {
    return false
  }
}

async function persistCandidate(db, value, stats) {
  const publicUrl = toPublicUploadPath(value)
  const absolutePath = toAbsoluteUploadPath(value)
  if (!publicUrl || !absolutePath) return
  const storageKey = getUploadStorageKey(publicUrl)
  if (!storageKey) return
  const existing = await getUploadedAssetByKey(db, storageKey)
  if (existing?.content_base64) {
    stats.skipped += 1
    return
  }
  if (!(await fileExists(absolutePath))) {
    stats.missing += 1
    return
  }
  const mimeType = (() => {
    const ext = path.extname(absolutePath).toLowerCase()
    if (ext === '.png') return 'image/png'
    if (ext === '.webp') return 'image/webp'
    if (ext === '.gif') return 'image/gif'
    if (ext === '.mp4') return 'video/mp4'
    if (ext === '.mov') return 'video/quicktime'
    return 'image/jpeg'
  })()
  await persistUploadedAsset(db, {
    publicUrl,
    absolutePath,
    mimeType,
    originalName: path.basename(absolutePath),
  })
  stats.persisted += 1
}

export async function backfillUploadedAssets(db) {
  const stats = { persisted: 0, skipped: 0, missing: 0 }
  const candidates = []

  const userRows = await all(db, `SELECT avatar_path FROM users WHERE avatar_path IS NOT NULL AND avatar_path <> ''`)
  for (const row of userRows) candidates.push(row.avatar_path)

  const kycRows = await all(
    db,
    `SELECT id_document_path, selfie_path
     FROM kyc_submissions
     WHERE id_document_path IS NOT NULL OR selfie_path IS NOT NULL`,
  )
  for (const row of kycRows) {
    candidates.push(row.id_document_path)
    candidates.push(row.selfie_path)
  }

  const depositRows = await all(
    db,
    `SELECT proof_image_path
     FROM deposit_requests
     WHERE proof_image_path IS NOT NULL AND proof_image_path <> ''`,
  )
  for (const row of depositRows) candidates.push(row.proof_image_path)

  const adRows = await all(
    db,
    `SELECT media_url
     FROM ads
     WHERE media_url IS NOT NULL AND media_url LIKE '/uploads/%'`,
  )
  for (const row of adRows) candidates.push(row.media_url)

  const settingRows = await all(db, `SELECT key, value FROM settings`)
  for (const row of settingRows) {
    const value = String(row?.value || '').trim()
    if (value.startsWith('/uploads/')) candidates.push(value)
    if (row?.key === 'mining_config') {
      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed?.mediaItems)) {
          for (const item of parsed.mediaItems) candidates.push(item?.url)
        }
      } catch {
        // ignore malformed config
      }
    }
  }

  const seen = new Set()
  for (const candidate of candidates) {
    const publicUrl = toPublicUploadPath(candidate)
    if (!publicUrl || seen.has(publicUrl)) continue
    seen.add(publicUrl)
    await persistCandidate(db, candidate, stats)
  }

  return stats
}
