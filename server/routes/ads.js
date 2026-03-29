import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import multer from 'multer'
import { all, get, run } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { publishLiveUpdate } from '../services/live-updates.js'
import { persistUploadedAsset, toUploadPublicUrl } from '../services/uploaded-assets.js'

const PLACEMENTS = new Set(['all', 'home', 'profile', 'mining', 'deposit'])
const PROMOTED_AD_MEDIA_URLS = new Set([
  '/ads/event-a.mp4',
  '/ads/breakcash-best.jpeg',
  '/ads/exclusive-offer-ar.jpeg',
  '/ads/exclusive-offer-en.jpeg',
  '/ads/breakcash-best-video.mp4',
])
const REMOVED_AD_MEDIA_URLS = ['/ads/event-banner.jpeg']
const SALES_PRIORITY_MEDIA_URLS = [
  '/ads/exclusive-offer-ar.jpeg',
  '/ads/exclusive-offer-en.jpeg',
  '/ads/breakcash-best-video.mp4',
]
const GLOBAL_PROMOTED_AD_ITEMS = [
  { type: 'image', mediaUrl: '/uploads/ads/mani.jpeg', title: 'Deposit', description: 'Open the deposit page', linkUrl: '/deposit' },
  { type: 'image', mediaUrl: '/uploads/ads/frnd.jpeg', title: 'Invite & Earn', description: 'Open referral center', linkUrl: '/referral' },
]
const SEEDED_PROMOTED_ASSETS = [
  {
    mediaUrl: '/uploads/ads/mani.jpeg',
    sourcePath: path.join(process.cwd(), 'server', 'seed-assets', 'ads', 'mani.jpeg'),
    mimeType: 'image/jpeg',
    originalName: 'mani.jpeg',
  },
  {
    mediaUrl: '/uploads/ads/frnd.jpeg',
    sourcePath: path.join(process.cwd(), 'server', 'seed-assets', 'ads', 'frnd.jpeg'),
    mimeType: 'image/jpeg',
    originalName: 'frnd.jpeg',
  },
]

const DEFAULT_ADS = {
  home: [
    { type: 'image', mediaUrl: '/ads/break-logo-promo.jpeg', title: '????? ????', description: '????? ?????? ??????', linkUrl: '/portfolio' },
    { type: 'image', mediaUrl: '/ads/exclusive-offer-ar.jpeg', title: 'Exclusive Offer AR', description: 'Referral bonus campaign', linkUrl: '/referral' },
    { type: 'video', mediaUrl: '/ads/mining-feed.mp4', title: '????? ????? ???', description: '??? ??????? ??????', linkUrl: '/mining' },
    { type: 'video', mediaUrl: '/ads/event-a.mp4', title: '????? ?', description: '??? ????? ????? ????? ?? ???? ??????? ?????????.', linkUrl: '/mining' },
    { type: 'video', mediaUrl: '/ads/mining-power.mp4', title: '????? ????? ????', description: '??? ???? ????? ???????', linkUrl: '/mining' },
    { type: 'image', mediaUrl: '/ads/breakcash-best.jpeg', title: '???? ??? ?? ??????', description: '???? ?????? ???? ?????? ?????? ???? ?????? ????????.', linkUrl: '/portfolio' },
    { type: 'video', mediaUrl: '/ads/breakcash-best-video.mp4', title: 'BreakCash Best Video', description: 'Brand campaign video', linkUrl: '/portfolio' },
    { type: 'image', mediaUrl: '/ads/exclusive-offer-en.jpeg', title: 'Exclusive Offer EN', description: 'Referral bonus campaign', linkUrl: '/referral' },
    { type: 'image', mediaUrl: '/ads/mining-banner.jpeg', title: '????? ?????', description: '?????? ????? ??????? ???? ??????', linkUrl: '/mining' },
    { type: 'image', mediaUrl: '/uploads/ads/mani.jpeg', title: 'Deposit', description: 'Open the deposit page', linkUrl: '/deposit' },
    { type: 'image', mediaUrl: '/uploads/ads/frnd.jpeg', title: 'Invite & Earn', description: 'Open referral center', linkUrl: '/referral' },
  ],
  deposit: [
    { type: 'image', mediaUrl: '/ads/break-logo-promo.jpeg', title: '????? ????', description: '????? ?????? ??????', linkUrl: '/portfolio' },
    { type: 'video', mediaUrl: '/ads/event-a.mp4', title: '????? ?', description: '??? ????? ????? ????? ?? ???? ??????? ?????????.', linkUrl: '/mining' },
    { type: 'image', mediaUrl: '/ads/exclusive-offer-en.jpeg', title: 'Exclusive Offer EN', description: 'Referral bonus campaign', linkUrl: '/referral' },
    { type: 'video', mediaUrl: '/ads/mining-feed.mp4', title: '????? ????? ???', description: '??? ??????? ??????', linkUrl: '/mining' },
    { type: 'image', mediaUrl: '/ads/breakcash-best.jpeg', title: '???? ??? ?? ??????', description: '???? ?????? ???? ?????? ?????? ???? ?????? ????????.', linkUrl: '/portfolio' },
    { type: 'video', mediaUrl: '/ads/breakcash-best-video.mp4', title: 'BreakCash Best Video', description: 'Brand campaign video', linkUrl: '/portfolio' },
    { type: 'video', mediaUrl: '/ads/mining-power.mp4', title: '????? ????? ????', description: '??? ???? ????? ???????', linkUrl: '/mining' },
    { type: 'image', mediaUrl: '/ads/exclusive-offer-ar.jpeg', title: 'Exclusive Offer AR', description: 'Referral bonus campaign', linkUrl: '/referral' },
    { type: 'image', mediaUrl: '/ads/mining-banner.jpeg', title: '????? ?????', description: '???? ??? ????? ??????? ???????', linkUrl: '/mining' },
    { type: 'image', mediaUrl: '/uploads/ads/mani.jpeg', title: 'Deposit', description: 'Open the deposit page', linkUrl: '/deposit' },
    { type: 'image', mediaUrl: '/uploads/ads/frnd.jpeg', title: 'Invite & Earn', description: 'Open referral center', linkUrl: '/referral' },
  ],
  mining: [
    { type: 'image', mediaUrl: '/ads/break-logo-promo.jpeg', title: '????? ????', description: '????? ?????? ??????', linkUrl: '/portfolio' },
    { type: 'image', mediaUrl: '/ads/breakcash-best.jpeg', title: '???? ??? ?? ??????', description: '???? ?????? ???? ?????? ?????? ???? ?????? ????????.', linkUrl: '/portfolio' },
    { type: 'video', mediaUrl: '/ads/breakcash-best-video.mp4', title: 'BreakCash Best Video', description: 'Brand campaign video', linkUrl: '/portfolio' },
    { type: 'video', mediaUrl: '/ads/mining-feed.mp4', title: '????? ????? ???', description: '??? ???? ???? ?? ???????', linkUrl: '/mining' },
    { type: 'image', mediaUrl: '/ads/exclusive-offer-ar.jpeg', title: 'Exclusive Offer AR', description: 'Referral bonus campaign', linkUrl: '/referral' },
    { type: 'video', mediaUrl: '/ads/mining-power.mp4', title: '????? ????? ????', description: '??? ???? ????? ???????', linkUrl: '/mining' },
    { type: 'video', mediaUrl: '/ads/event-a.mp4', title: '????? ?', description: '??? ????? ????? ????? ?? ???? ??????? ?????????.', linkUrl: '/mining' },
    { type: 'image', mediaUrl: '/ads/exclusive-offer-en.jpeg', title: 'Exclusive Offer EN', description: 'Referral bonus campaign', linkUrl: '/referral' },
    { type: 'image', mediaUrl: '/ads/mining-banner.jpeg', title: '????? ?????', description: '???? ????? ??????? ???????? ??', linkUrl: '/mining' },
    { type: 'image', mediaUrl: '/uploads/ads/mani.jpeg', title: 'Deposit', description: 'Open the deposit page', linkUrl: '/deposit' },
    { type: 'image', mediaUrl: '/uploads/ads/frnd.jpeg', title: 'Invite & Earn', description: 'Open referral center', linkUrl: '/referral' },
  ],
  profile: [
    { type: 'image', mediaUrl: '/ads/break-logo-promo.jpeg', title: '????? ????', description: '????? ?????? ??????', linkUrl: '/portfolio' },
    { type: 'video', mediaUrl: '/ads/event-a.mp4', title: '????? ?', description: '??? ????? ????? ????? ?? ???? ??????? ?????????.', linkUrl: '/mining' },
    { type: 'image', mediaUrl: '/ads/exclusive-offer-en.jpeg', title: 'Exclusive Offer EN', description: 'Referral bonus campaign', linkUrl: '/referral' },
    { type: 'video', mediaUrl: '/ads/mining-feed.mp4', title: '????? ????? ???', description: '??? ??????? ??????', linkUrl: '/mining' },
    { type: 'image', mediaUrl: '/ads/exclusive-offer-ar.jpeg', title: 'Exclusive Offer AR', description: 'Referral bonus campaign', linkUrl: '/referral' },
    { type: 'video', mediaUrl: '/ads/mining-power.mp4', title: '????? ????? ????', description: '??? ???? ????? ???????', linkUrl: '/mining' },
    { type: 'image', mediaUrl: '/ads/breakcash-best.jpeg', title: '???? ??? ?? ??????', description: '???? ?????? ???? ?????? ?????? ???? ?????? ????????.', linkUrl: '/portfolio' },
    { type: 'video', mediaUrl: '/ads/breakcash-best-video.mp4', title: 'BreakCash Best Video', description: 'Brand campaign video', linkUrl: '/portfolio' },
    { type: 'image', mediaUrl: '/ads/mining-banner.jpeg', title: '????? ?????', description: '?????? ????? ??????? ???? ??????', linkUrl: '/mining' },
    { type: 'image', mediaUrl: '/uploads/ads/mani.jpeg', title: 'Deposit', description: 'Open the deposit page', linkUrl: '/deposit' },
    { type: 'image', mediaUrl: '/uploads/ads/frnd.jpeg', title: 'Invite & Earn', description: 'Open referral center', linkUrl: '/referral' },
  ],
}

const asyncRoute = (handler) => async (req, res) => {
  try {
    await handler(req, res)
  } catch (error) {
    console.error('[ads-route-error]', error)
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Ads service failed.' })
  }
}

function toPublicPath(absPath) {
  return absPath ? toUploadPublicUrl(absPath) : null
}

function normalizeAdRow(row) {
  return {
    id: Number(row.id),
    type: row.type,
    mediaUrl: row.media_url,
    title: row.title || '',
    description: row.description || '',
    linkUrl: row.link_url || '',
    placement: row.placement,
    sortOrder: Number(row.sort_order || 0),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function getDefaultAdsForPlacement(placement) {
  const items = Array.isArray(DEFAULT_ADS[placement]) ? DEFAULT_ADS[placement] : []
  return items.map((item, index) => ({
    id: 900000 + index + placement.length * 100,
    type: item.type,
    mediaUrl: item.mediaUrl,
    title: item.title || '',
    description: item.description || '',
    linkUrl: item.linkUrl || '',
    placement,
    sortOrder: index,
    isActive: true,
    createdAt: null,
    updatedAt: null,
  }))
}

async function ensureSeededPromotedAssetsPersisted(db) {
  for (const asset of SEEDED_PROMOTED_ASSETS) {
    if (!fs.existsSync(asset.sourcePath)) continue
    await persistUploadedAsset(db, {
      publicUrl: asset.mediaUrl,
      absolutePath: asset.sourcePath,
      mimeType: asset.mimeType,
      originalName: asset.originalName,
    })
  }
}

async function ensurePromotedAdsPersisted(db) {
  await ensureSeededPromotedAssetsPersisted(db)
  for (const mediaUrl of REMOVED_AD_MEDIA_URLS) {
    await run(db, `DELETE FROM ads WHERE media_url = ?`, [mediaUrl])
  }
  for (const item of GLOBAL_PROMOTED_AD_ITEMS) {
    const existingGlobal = await get(
      db,
      `SELECT id, is_active
       FROM ads
       WHERE placement = 'all' AND media_url = ?
       ORDER BY id ASC
       LIMIT 1`,
      [item.mediaUrl],
    )
    if (existingGlobal?.id) {
      if (!Number(existingGlobal.is_active)) {
        await run(
          db,
          `UPDATE ads
           SET is_active = 1,
               updated_at = datetime('now')
           WHERE id = ?`,
          [existingGlobal.id],
        )
      }
    } else {
      const maxGlobalSortRow = await get(
        db,
        `SELECT COALESCE(MAX(sort_order), -1) AS max_sort
         FROM ads
         WHERE placement = 'all'`,
      )
      const nextGlobalSort = Number(maxGlobalSortRow?.max_sort ?? -1) + 1
      await run(
        db,
        `INSERT INTO ads (type, media_url, title, description, link_url, placement, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, 'all', ?, 1)`,
        [item.type, item.mediaUrl, item.title || '', item.description || '', item.linkUrl || null, nextGlobalSort],
      )
    }
    await run(
      db,
      `DELETE FROM ads
       WHERE placement IN ('home', 'deposit', 'mining', 'profile') AND media_url = ?`,
      [item.mediaUrl],
    )
  }
  for (const placement of ['home', 'deposit', 'mining', 'profile']) {
    const placementDefaults = Array.isArray(DEFAULT_ADS[placement]) ? DEFAULT_ADS[placement] : []
    const promotedItems = placementDefaults.filter((item) => PROMOTED_AD_MEDIA_URLS.has(String(item.mediaUrl || '').trim()))
    if (promotedItems.length === 0) continue

    const maxSortRow = await get(
      db,
      `SELECT COALESCE(MAX(sort_order), -1) AS max_sort
       FROM ads
       WHERE placement = ?`,
      [placement],
    )
    let nextSort = Number(maxSortRow?.max_sort ?? -1) + 1

    for (const item of promotedItems) {
      const mediaUrl = String(item.mediaUrl || '').trim()
      const existing = await get(
        db,
        `SELECT id, is_active, sort_order
         FROM ads
         WHERE placement = ? AND media_url = ?
         ORDER BY id ASC
         LIMIT 1`,
        [placement, mediaUrl],
      )

      if (existing?.id) {
        if (!Number(existing.is_active)) {
          await run(
            db,
            `UPDATE ads
             SET is_active = 1,
                 updated_at = datetime('now')
             WHERE id = ?`,
            [existing.id],
          )
        }
        continue
      }

      await run(
        db,
        `INSERT INTO ads (type, media_url, title, description, link_url, placement, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [item.type, mediaUrl, item.title || '', item.description || '', item.linkUrl || null, placement, nextSort],
      )
      nextSort += 1
    }

    const placementRows = await all(
      db,
      `SELECT id, media_url
       FROM ads
       WHERE placement = ?
       ORDER BY sort_order ASC, id ASC`,
      [placement],
    )

    const salesRows = []
    const otherRows = []
    for (const row of placementRows) {
      if (SALES_PRIORITY_MEDIA_URLS.includes(String(row.media_url || '').trim())) {
        salesRows.push(row)
      } else {
        otherRows.push(row)
      }
    }

    salesRows.sort(
      (a, b) =>
        SALES_PRIORITY_MEDIA_URLS.indexOf(String(a.media_url || '').trim()) -
        SALES_PRIORITY_MEDIA_URLS.indexOf(String(b.media_url || '').trim()),
    )

    const orderedRows = [...salesRows, ...otherRows]
    for (let index = 0; index < orderedRows.length; index += 1) {
      await run(
        db,
        `UPDATE ads
         SET sort_order = ?,
             updated_at = datetime('now')
         WHERE id = ?`,
        [index, orderedRows[index].id],
      )
    }
  }
}

export function createAdsRouter(db) {
  const router = Router()
  const uploadsRoot = path.join(process.cwd(), 'server', 'uploads')
  const adsDir = path.join(uploadsRoot, 'ads')
  fs.mkdirSync(adsDir, { recursive: true })

  const MAX_FILE_SIZE = 50 * 1024 * 1024

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, adsDir),
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase() || '.png'
        const mime = String(file.mimetype || '').toLowerCase()
        const isVideo = mime.startsWith('video/')
        const suffix = isVideo ? ext : (ext || '.png')
        cb(null, `ad_${req.user?.id || 'x'}_${Date.now()}${suffix}`)
      },
    }),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
      const mime = String(file.mimetype || '').toLowerCase()
      const ok = mime.startsWith('image/') || mime.startsWith('video/')
      if (ok) cb(null, true)
      else cb(new Error('INVALID_FILE_TYPE'))
    },
  })

  router.get('/', asyncRoute(async (req, res) => {
    await ensurePromotedAdsPersisted(db)
    const placement = String(req.query.placement || 'all').trim().toLowerCase()
    const p = PLACEMENTS.has(placement) ? placement : 'all'
    const rows = await all(
      db,
      `SELECT id, type, media_url, title, description, link_url, placement, sort_order, is_active, created_at, updated_at
       FROM ads
       WHERE is_active = 1 AND (placement = ? OR placement = 'all')
      ORDER BY sort_order ASC, id ASC`,
      [p],
    )
    const dbItems = rows.map(normalizeAdRow)
    const items = dbItems.length > 0 ? dbItems : getDefaultAdsForPlacement(p)
    return res.json({
      items,
    })
  }))

  router.get('/admin', requireAuth(db), requireRole('owner'), asyncRoute(async (_req, res) => {
    await ensurePromotedAdsPersisted(db)
    const rows = await all(
      db,
      `SELECT id, type, media_url, title, description, link_url, placement, sort_order, is_active, created_at, updated_at
       FROM ads
       ORDER BY sort_order ASC, id ASC`,
    )
    return res.json({
      items: rows.map(normalizeAdRow),
    })
  }))

  router.post('/upload', requireAuth(db), requireRole('owner'), asyncRoute(async (req, res) => {
    try {
      await new Promise((resolve, reject) => {
        upload.single('media')(req, res, (err) => (err ? reject(err) : resolve(null)))
      })
    } catch (uploadErr) {
      if (uploadErr?.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'FILE_TOO_LARGE', message: 'File too large' })
      }
      if (uploadErr?.message === 'INVALID_FILE_TYPE') {
        return res.status(400).json({ error: 'INVALID_FILE_TYPE', message: 'File must be image or video' })
      }
      return res.status(400).json({ error: 'UPLOAD_FAILED', message: 'Upload failed' })
    }
    if (!req.file) return res.status(400).json({ error: 'FILE_REQUIRED', message: 'No file provided' })
    const mime = String(req.file.mimetype || '').toLowerCase()
    const isVideo = mime.startsWith('video/')
    const isImage = mime.startsWith('image/')
    if (!isImage && !isVideo) {
      return res.status(400).json({ error: 'INVALID_FILE_TYPE', message: 'File must be image or video' })
    }
    const publicUrl = toPublicPath(req.file.path)
    await persistUploadedAsset(db, {
      publicUrl,
      absolutePath: req.file.path,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
    })
    return res.json({ ok: true, url: toUploadPublicUrl(publicUrl) || publicUrl, type: isVideo ? 'video' : 'image' })
  }))

  router.post('/', requireAuth(db), requireRole('owner'), asyncRoute(async (req, res) => {
    const type = String(req.body?.type || 'image').toLowerCase()
    const mediaUrl = String(req.body?.mediaUrl || '').trim()
    const title = String(req.body?.title || '').trim().slice(0, 120)
    const description = String(req.body?.description || '').trim().slice(0, 400)
    const linkUrl = String(req.body?.linkUrl || '').trim().slice(0, 500)
    const placementVal = String(req.body?.placement ?? 'all').trim().toLowerCase()
    const placement = PLACEMENTS.has(placementVal) ? placementVal : 'all'
    const sortOrder = Number(req.body?.sortOrder) || 0
    const isActive = req.body?.isActive !== false ? 1 : 0
    if (!mediaUrl) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Media URL required' })
    if (type !== 'image' && type !== 'video') {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Type must be image or video' })
    }
    const result = await run(
      db,
      `INSERT INTO ads (type, media_url, title, description, link_url, placement, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [type, mediaUrl, title, description, linkUrl || null, placement, sortOrder, isActive],
    )
    const id = result.rows?.[0]?.id ?? result.lastID
    const row = await get(db, `SELECT * FROM ads WHERE id = ? LIMIT 1`, [id])
    publishLiveUpdate({ type: 'home_content_updated', source: 'ads', key: 'ads' })
    return res.json({
      ok: true,
      ad: {
        id: row.id,
        type: row.type,
        mediaUrl: row.media_url,
        title: row.title || '',
        description: row.description || '',
        linkUrl: row.link_url || '',
        placement: row.placement,
        sortOrder: row.sort_order,
        isActive: Boolean(row.is_active),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    })
  }))

  router.put('/:id', requireAuth(db), requireRole('owner'), asyncRoute(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'INVALID_INPUT' })
    const existing = await get(db, `SELECT id, media_url, sort_order FROM ads WHERE id = ? LIMIT 1`, [id])
    if (!existing) return res.status(404).json({ error: 'NOT_FOUND' })
    const type = String(req.body?.type || 'image').toLowerCase()
    // Node 20 ESM: avoid ??/|| mix in single expression (SyntaxError on Railway)
    const mediaUrlRaw = req.body?.mediaUrl ?? existing.media_url ?? ''
    const mediaUrl = String(mediaUrlRaw).trim()
    const title = String(req.body?.title ?? '').trim().slice(0, 120)
    const description = String(req.body?.description ?? '').trim().slice(0, 400)
    const linkUrl = String(req.body?.linkUrl ?? '').trim().slice(0, 500)
    const placementVal = String(req.body?.placement ?? 'all').trim().toLowerCase()
    const placement = PLACEMENTS.has(placementVal) ? placementVal : 'all'
    const requestedSortOrder = Number(req.body?.sortOrder)
    const sortOrder = Number.isFinite(requestedSortOrder) ? requestedSortOrder : Number(existing.sort_order || 0)
    const isActive = req.body?.isActive !== false ? 1 : 0
    if (type !== 'image' && type !== 'video') {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Type must be image or video' })
    }
    await run(
      db,
      `UPDATE ads SET type = ?, media_url = ?, title = ?, description = ?, link_url = ?, placement = ?, sort_order = ?, is_active = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [type, mediaUrl, title, description, linkUrl || null, placement, sortOrder, isActive, id],
    )
    publishLiveUpdate({ type: 'home_content_updated', source: 'ads', key: 'ads' })
    const row = await get(db, `SELECT * FROM ads WHERE id = ? LIMIT 1`, [id])
    return res.json({
      ok: true,
      ad: {
        id: row.id,
        type: row.type,
        mediaUrl: row.media_url,
        title: row.title || '',
        description: row.description || '',
        linkUrl: row.link_url || '',
        placement: row.placement,
        sortOrder: row.sort_order,
        isActive: Boolean(row.is_active),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    })
  }))

  router.put('/:id/toggle', requireAuth(db), requireRole('owner'), asyncRoute(async (req, res) => {
    const id = Number(req.params.id)
    const isActive = req.body?.isActive !== false ? 1 : 0
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'INVALID_INPUT' })
    await run(db, `UPDATE ads SET is_active = ?, updated_at = datetime('now') WHERE id = ?`, [isActive, id])
    publishLiveUpdate({ type: 'home_content_updated', source: 'ads', key: 'ads' })
    return res.json({ ok: true })
  }))

  router.delete('/:id', requireAuth(db), requireRole('owner'), asyncRoute(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'INVALID_INPUT' })
    await run(db, `DELETE FROM ads WHERE id = ?`, [id])
    publishLiveUpdate({ type: 'home_content_updated', source: 'ads', key: 'ads' })
    return res.json({ ok: true })
  }))

  router.put('/reorder', requireAuth(db), requireRole('owner'), asyncRoute(async (req, res) => {
    const order = Array.isArray(req.body?.order) ? req.body.order : []
    for (let i = 0; i < order.length; i++) {
      const id = Number(order[i])
      if (Number.isFinite(id) && id > 0) {
        await run(db, `UPDATE ads SET sort_order = ?, updated_at = datetime('now') WHERE id = ?`, [i, id])
      }
    }
    publishLiveUpdate({ type: 'home_content_updated', source: 'ads', key: 'ads' })
    return res.json({ ok: true })
  }))

  return router
}
