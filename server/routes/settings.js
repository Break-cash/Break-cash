import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import multer from 'multer'
import { all, get, run } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { publishLiveUpdate } from '../services/live-updates.js'

const DEFAULT_BRAND_LOGO_URL = '/break-cash-logo-premium.png'

const asyncRoute = (handler) => async (req, res) => {
  try {
    await handler(req, res)
  } catch (error) {
    console.error('[settings-route-error]', error)
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Settings service failed.' })
  }
}

export function createSettingsRouter(db) {
  const router = Router()
  const uploadsRoot = path.join(process.cwd(), 'server', 'uploads')
  const settingsImagesDir = path.join(uploadsRoot, 'settings')
  fs.mkdirSync(settingsImagesDir, { recursive: true })

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, settingsImagesDir),
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase() || '.png'
        cb(null, `owner_${req.user?.id || 'x'}_${Date.now()}${ext}`)
      },
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
  })

  async function upsertSettingValue(key, value) {
    await run(
      db,
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [String(key), String(value || '')],
    )
  }

  async function syncBrandLogos(logoUrlRaw) {
    const logoUrl = String(logoUrlRaw || '').trim()
    if (!logoUrl) return

    await upsertSettingValue('favicon_url', logoUrl)
    await upsertSettingValue('apple_touch_icon_url', logoUrl)

    const pwaRow = await get(db, `SELECT value FROM settings WHERE key='pwa_config' LIMIT 1`)
    let parsed = null
    try {
      parsed = JSON.parse(String(pwaRow?.value || 'null'))
    } catch {
      parsed = null
    }
    const baseConfig = normalizePwaConfig(parsed)
    const nextConfig = {
      ...baseConfig,
      icon_192: logoUrl,
      icon_512: logoUrl,
    }
    await upsertSettingValue('pwa_config', JSON.stringify(nextConfig))
  }

  function toPublicPath(absPath) {
    const rel = path.relative(path.join(process.cwd(), 'server'), absPath).replaceAll('\\', '/')
    return `/uploads/${rel.replace(/^uploads\//, '')}`
  }

  function normalizeImageKey(rawKey) {
    const key = String(rawKey || '').trim().toLowerCase()
    if (!key) return 'logo_url'
    if (key === 'logo' || key === 'logo_url') return 'logo_url'
    if (!/^[a-z0-9_]{3,48}$/.test(key)) return null
    return key
  }

  const DEFAULT_MOBILE_NAV_CONFIG = [
    { id: 'assets', to: '/assets', label: 'Assets', icon: 'wallet', isFab: false },
    { id: 'markets', to: '/market', label: 'Markets', icon: 'candlestick', isFab: false },
    { id: 'tasks', to: '/futures', label: 'Tasks', icon: 'candlestick', isFab: true },
    { id: 'mining', to: '/mining', label: 'Mining', icon: 'pickaxe', isFab: false },
    { id: 'home', to: '/portfolio', label: 'Home', icon: 'house', isFab: false },
  ]

  function normalizeMobileNavConfig(raw) {
    if (!Array.isArray(raw) || raw.length !== 5) return DEFAULT_MOBILE_NAV_CONFIG
    const allowedIcons = new Set(['wallet', 'chart', 'pickaxe', 'house', 'candlestick', 'sparkles', 'bcmark'])
    const normalized = raw
      .map((item, idx) => ({
        id: String(item?.id || `item_${idx + 1}`).trim().slice(0, 32),
        to: String(item?.to || '').trim() || DEFAULT_MOBILE_NAV_CONFIG[idx].to,
        label: String(item?.label || '').trim().slice(0, 24) || DEFAULT_MOBILE_NAV_CONFIG[idx].label,
        icon: String(item?.icon || '').trim().toLowerCase(),
        isFab: Boolean(item?.isFab),
      }))
      .map((item, idx) => ({
        ...item,
        icon: allowedIcons.has(item.icon) ? item.icon : DEFAULT_MOBILE_NAV_CONFIG[idx].icon,
      }))
    const fabCount = normalized.filter((x) => x.isFab).length
    if (fabCount !== 1) {
      return normalized.map((x, idx) => ({ ...x, isFab: idx === 2 }))
    }
    return normalized
  }

  const DEFAULT_HEADER_ICON_CONFIG = [
    { id: 'search', visible: true },
    { id: 'language', visible: true },
    { id: 'notifications', visible: true },
    { id: 'profile', visible: true },
  ]

  function normalizeHeaderIconConfig(raw) {
    if (!Array.isArray(raw)) return DEFAULT_HEADER_ICON_CONFIG
    const allowed = new Set(['search', 'language', 'notifications', 'profile'])
    const seen = new Set()
    const normalized = []
    for (const item of raw) {
      const id = String(item?.id || '').trim().toLowerCase()
      if (!allowed.has(id) || seen.has(id)) continue
      seen.add(id)
      normalized.push({
        id,
        visible: id === 'profile' ? true : Boolean(item?.visible),
      })
    }
    for (const base of DEFAULT_HEADER_ICON_CONFIG) {
      if (!seen.has(base.id)) normalized.push(base)
    }
    return normalized.slice(0, 4)
  }

  const DEFAULT_PROMO_BANNERS = [
    {
      id: 'home-default',
      title: 'Break cash Trading Booster',
      subtitle: 'Activate featured opportunities and discover high-momentum pairs with one tap.',
      ctaLabel: 'Explore',
      to: '/market',
      imageUrl: '',
      backgroundStyle: '',
      order: 1,
      placement: 'home',
      enabled: true,
    },
    {
      id: 'profile-default',
      title: 'First Deposit Reward',
      subtitle: 'Deposit now to unlock premium member benefits and extra rewards.',
      ctaLabel: 'Deposit',
      to: '/deposit',
      imageUrl: '',
      backgroundStyle: '',
      order: 2,
      placement: 'profile',
      enabled: true,
    },
  ]

  function normalizePromoBanners(raw) {
    if (!Array.isArray(raw)) return DEFAULT_PROMO_BANNERS
    const allowedPlacement = new Set(['all', 'home', 'profile'])
    const normalized = raw
      .map((item, idx) => {
        const placementRaw = String(item?.placement || 'all').trim().toLowerCase()
        const placement = allowedPlacement.has(placementRaw) ? placementRaw : 'all'
        return {
          id: String(item?.id || `banner_${idx + 1}`).trim().slice(0, 48),
          title: String(item?.title || '').trim().slice(0, 90),
          subtitle: String(item?.subtitle || '').trim().slice(0, 220),
          ctaLabel: String(item?.ctaLabel || '').trim().slice(0, 24),
          to: String(item?.to || '').trim().slice(0, 120),
          imageUrl: String(item?.imageUrl || '').trim().slice(0, 220),
          backgroundStyle: String(item?.backgroundStyle || '').trim().slice(0, 220),
          order: Number.isFinite(Number(item?.order)) ? Number(item.order) : idx + 1,
          placement,
          enabled: Boolean(item?.enabled),
        }
      })
      .filter((item) => item.id && item.title && item.subtitle)
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
      .slice(0, 12)
    return normalized
  }

  const DEFAULT_PWA_CONFIG = {
    name: 'Break cash',
    short_name: 'Break cash',
    description: 'Invite-only trading dashboard PWA',
    background_color: '#0A0E17',
    theme_color: '#00C853',
    icon_192: DEFAULT_BRAND_LOGO_URL,
    icon_512: DEFAULT_BRAND_LOGO_URL,
  }

  function normalizeHexColor(raw, fallback) {
    const value = String(raw || '').trim()
    return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback
  }

  function normalizePwaConfig(raw) {
    const obj = typeof raw === 'object' && raw ? raw : {}
    return {
      name: String(obj.name || '').trim().slice(0, 64) || DEFAULT_PWA_CONFIG.name,
      short_name: String(obj.short_name || '').trim().slice(0, 32) || DEFAULT_PWA_CONFIG.short_name,
      description: String(obj.description || '').trim().slice(0, 140) || DEFAULT_PWA_CONFIG.description,
      background_color: normalizeHexColor(obj.background_color, DEFAULT_PWA_CONFIG.background_color),
      theme_color: normalizeHexColor(obj.theme_color, DEFAULT_PWA_CONFIG.theme_color),
      icon_192: String(obj.icon_192 || '').trim() || DEFAULT_PWA_CONFIG.icon_192,
      icon_512: String(obj.icon_512 || '').trim() || DEFAULT_PWA_CONFIG.icon_512,
    }
  }

  router.get('/wallet-link', asyncRoute(async (_req, res) => {
    const row = await get(db, `SELECT value FROM settings WHERE key='wallet_link' LIMIT 1`)
    return res.json({ walletLink: row?.value || '' })
  }))

  router.post('/wallet-link', requireAuth(db), requireRole('owner'), asyncRoute(async (req, res) => {
    const walletLink = String(req.body?.walletLink || '').trim()
    if (!walletLink) return res.status(400).json({ error: 'INVALID_INPUT' })
    await run(
      db,
      `INSERT INTO settings (key, value) VALUES ('wallet_link', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [walletLink],
    )
    publishLiveUpdate({ type: 'announcement_updated', source: 'settings', key: 'wallet_link' })
    return res.json({ ok: true, walletLink })
  }))

  router.get('/logo-url', asyncRoute(async (_req, res) => {
    const row = await get(db, `SELECT value FROM settings WHERE key='logo_url' LIMIT 1`)
    const logoUrl = String(row?.value || '').trim() || DEFAULT_BRAND_LOGO_URL
    return res.json({ logoUrl })
  }))

  router.post('/logo-url', requireAuth(db), requireRole('owner'), asyncRoute(async (req, res) => {
    const logoUrl = String(req.body?.logoUrl ?? '').trim()
    await upsertSettingValue('logo_url', logoUrl || '')
    await syncBrandLogos(logoUrl || '')
    return res.json({ ok: true, logoUrl: logoUrl || '' })
  }))

  router.get('/favicon-url', asyncRoute(async (_req, res) => {
    const row = await get(db, `SELECT value FROM settings WHERE key='favicon_url' LIMIT 1`)
    const faviconUrl = String(row?.value || '').trim() || DEFAULT_BRAND_LOGO_URL
    return res.json({ faviconUrl })
  }))

  router.post('/favicon-url', requireAuth(db), requireRole('owner'), asyncRoute(async (req, res) => {
    const faviconUrl = String(req.body?.faviconUrl ?? '').trim()
    await run(
      db,
      `INSERT INTO settings (key, value) VALUES ('favicon_url', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [faviconUrl || ''],
    )
    return res.json({ ok: true, faviconUrl: faviconUrl || '' })
  }))

  router.get('/apple-touch-icon-url', asyncRoute(async (_req, res) => {
    const row = await get(db, `SELECT value FROM settings WHERE key='apple_touch_icon_url' LIMIT 1`)
    const appleTouchIconUrl = String(row?.value || '').trim() || DEFAULT_BRAND_LOGO_URL
    return res.json({ appleTouchIconUrl })
  }))

  router.post('/apple-touch-icon-url', requireAuth(db), requireRole('owner'), asyncRoute(async (req, res) => {
    const appleTouchIconUrl = String(req.body?.appleTouchIconUrl ?? '').trim()
    await run(
      db,
      `INSERT INTO settings (key, value) VALUES ('apple_touch_icon_url', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [appleTouchIconUrl || ''],
    )
    return res.json({ ok: true, appleTouchIconUrl: appleTouchIconUrl || '' })
  }))

  router.get('/theme-color', asyncRoute(async (_req, res) => {
    const row = await get(db, `SELECT value FROM settings WHERE key='theme_color' LIMIT 1`)
    const themeColor = String(row?.value || '#00C853').trim()
    return res.json({ themeColor })
  }))

  router.post('/theme-color', requireAuth(db), requireRole('owner'), asyncRoute(async (req, res) => {
    const raw = String(req.body?.themeColor ?? '').trim()
    const themeColor = /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : '#00C853'
    await run(
      db,
      `INSERT INTO settings (key, value) VALUES ('theme_color', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [themeColor],
    )
    return res.json({ ok: true, themeColor })
  }))

  router.get('/pwa-config', asyncRoute(async (_req, res) => {
    const row = await get(db, `SELECT value FROM settings WHERE key='pwa_config' LIMIT 1`)
    let parsed = null
    try {
      parsed = JSON.parse(String(row?.value || 'null'))
    } catch {
      parsed = null
    }
    const config = normalizePwaConfig(parsed)
    return res.json({ config, customized: Boolean(row) })
  }))

  router.post('/pwa-config', requireAuth(db), requireRole('owner'), asyncRoute(async (req, res) => {
    const config = normalizePwaConfig(req.body?.config)
    await run(
      db,
      `INSERT INTO settings (key, value) VALUES ('pwa_config', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [JSON.stringify(config)],
    )
    return res.json({ ok: true, config })
  }))

  router.get('/login-logo-variant', asyncRoute(async (_req, res) => {
    const row = await get(db, `SELECT value FROM settings WHERE key='login_logo_variant' LIMIT 1`)
    const value = String(row?.value || 'a').trim().toLowerCase()
    const variant = value === 'b' ? 'b' : 'a'
    return res.json({ variant })
  }))

  router.post('/login-logo-variant', requireAuth(db), requireRole('owner'), asyncRoute(async (req, res) => {
    const raw = String(req.body?.variant || '').trim().toLowerCase()
    const variant = raw === 'b' ? 'b' : 'a'
    await run(
      db,
      `INSERT INTO settings (key, value) VALUES ('login_logo_variant', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [variant],
    )
    return res.json({ ok: true, variant })
  }))

  router.get('/mobile-nav-config', asyncRoute(async (_req, res) => {
    const row = await get(db, `SELECT value FROM settings WHERE key='mobile_nav_config' LIMIT 1`)
    let parsed = null
    try {
      parsed = JSON.parse(String(row?.value || 'null'))
    } catch {
      parsed = null
    }
    const items = normalizeMobileNavConfig(parsed)
    return res.json({ items, customized: Boolean(row) })
  }))

  router.post('/mobile-nav-config', requireAuth(db), requireRole('owner'), asyncRoute(async (req, res) => {
    const items = normalizeMobileNavConfig(req.body?.items)
    await run(
      db,
      `INSERT INTO settings (key, value) VALUES ('mobile_nav_config', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [JSON.stringify(items)],
    )
    return res.json({ ok: true, items })
  }))

  router.get('/header-icon-config', asyncRoute(async (_req, res) => {
    const row = await get(db, `SELECT value FROM settings WHERE key='header_icon_config' LIMIT 1`)
    let parsed = null
    try {
      parsed = JSON.parse(String(row?.value || 'null'))
    } catch {
      parsed = null
    }
    const items = normalizeHeaderIconConfig(parsed)
    return res.json({ items, customized: Boolean(row) })
  }))

  router.post('/header-icon-config', requireAuth(db), requireRole('owner'), asyncRoute(async (req, res) => {
    const items = normalizeHeaderIconConfig(req.body?.items)
    await run(
      db,
      `INSERT INTO settings (key, value) VALUES ('header_icon_config', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [JSON.stringify(items)],
    )
    return res.json({ ok: true, items })
  }))

  router.get('/promo-banners', asyncRoute(async (_req, res) => {
    const row = await get(db, `SELECT value FROM settings WHERE key='promo_banners' LIMIT 1`)
    let parsed = null
    try {
      parsed = JSON.parse(String(row?.value || 'null'))
    } catch {
      parsed = null
    }
    const items = normalizePromoBanners(parsed)
    return res.json({ items, customized: Boolean(row) })
  }))

  router.post('/promo-banners', requireAuth(db), requireRole('owner'), asyncRoute(async (req, res) => {
    const items = normalizePromoBanners(req.body?.items)
    await run(
      db,
      `INSERT INTO settings (key, value) VALUES ('promo_banners', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [JSON.stringify(items)],
    )
    publishLiveUpdate({ type: 'home_content_updated', source: 'settings', key: 'promo_banners' })
    return res.json({ ok: true, items })
  }))

  router.get('/asset-images', asyncRoute(async (_req, res) => {
    const rows = await all(
      db,
      `SELECT key, value
       FROM settings
       WHERE key = 'logo_url' OR key LIKE 'app_image_%'`,
    )
    return res.json({
      images: rows.map((row) => ({ key: row.key, url: String(row.value || '') })),
    })
  }))

  router.post('/asset-image', requireAuth(db), requireRole('owner'), asyncRoute(async (req, res) => {
    await new Promise((resolve, reject) => {
      upload.single('image')(req, res, (error) => {
        if (error) return reject(error)
        return resolve(null)
      })
    }).catch((error) => {
      if (error && typeof error === 'object' && 'code' in error) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'FILE_TOO_LARGE' })
        }
      }
      return res.status(400).json({ error: 'UPLOAD_FAILED' })
    })
    if (res.headersSent) return

    const key = normalizeImageKey(req.body?.key)
    if (!key) return res.status(400).json({ error: 'INVALID_INPUT' })
    if (!req.file) return res.status(400).json({ error: 'FILE_REQUIRED' })
    const mime = String(req.file.mimetype || '').toLowerCase()
    if (!mime.startsWith('image/')) {
      return res.status(400).json({ error: 'INVALID_FILE_TYPE' })
    }

    const publicUrl = toPublicPath(req.file.path)
    await upsertSettingValue(key, publicUrl)
    if (key === 'logo_url') {
      await syncBrandLogos(publicUrl)
    }
    return res.json({ ok: true, key, url: publicUrl })
  }))

  router.get('/registration-status', asyncRoute(async (_req, res) => {
    const row = await get(db, `SELECT value FROM settings WHERE key='registration_enabled' LIMIT 1`)
    const enabled = row ? String(row.value) !== '0' : false
    return res.json({ enabled })
  }))

  router.post('/registration-status', requireAuth(db), requireRole('owner'), asyncRoute(async (req, res) => {
    const enabled = req.body?.enabled === false ? 0 : 1
    await run(
      db,
      `INSERT INTO settings (key, value) VALUES ('registration_enabled', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [String(enabled)],
    )
    publishLiveUpdate({ type: 'home_content_updated', source: 'settings', key: 'registration_enabled' })
    return res.json({ ok: true, enabled: enabled === 1 })
  }))

  router.get('/icon-attraction-keys', asyncRoute(async (_req, res) => {
    const row = await get(db, `SELECT value FROM settings WHERE key='icon_attraction_keys' LIMIT 1`)
    let parsed = null
    try {
      parsed = JSON.parse(String(row?.value || 'null'))
    } catch {
      parsed = null
    }
    const allowedKeys = new Set(['hot', 'new', 'most_requested'])
    const allowedTargets = new Set([
      'assets',
      'markets',
      'tasks',
      'mining',
      'home',
      'quick_buy',
      'rewards_center',
      'referrals',
      'more',
    ])
    let keys = []
    let targets = []
    let assignments = {}
    // Backward-compatible: old value might be just ["hot","new"].
    if (Array.isArray(parsed)) {
      keys = parsed
    } else if (parsed && typeof parsed === 'object') {
      keys = Array.isArray(parsed.keys) ? parsed.keys : []
      targets = Array.isArray(parsed.targets) ? parsed.targets : []
      assignments = parsed.assignments && typeof parsed.assignments === 'object' ? parsed.assignments : {}
    }
    const normalized = keys
      .map((v) => String(v || '').trim().toLowerCase())
      .filter((v) => allowedKeys.has(v))
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .slice(0, 3)
    const normalizedTargets = targets
      .map((v) => String(v || '').trim().toLowerCase())
      .filter((v) => allowedTargets.has(v))
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .slice(0, 9)
    const normalizedAssignments = Object.fromEntries(
      Object.entries(assignments || {})
        .map(([k, v]) => [String(k || '').trim().toLowerCase(), String(v || '').trim().toLowerCase()])
        .filter(([k, v]) => allowedTargets.has(k) && allowedKeys.has(v)),
    )
    return res.json({ keys: normalized, targets: normalizedTargets, assignments: normalizedAssignments })
  }))

  router.post('/icon-attraction-keys', requireAuth(db), requireRole('owner'), asyncRoute(async (req, res) => {
    const allowedKeys = new Set(['hot', 'new', 'most_requested'])
    const allowedTargets = new Set([
      'assets',
      'markets',
      'tasks',
      'mining',
      'home',
      'quick_buy',
      'rewards_center',
      'referrals',
      'more',
    ])
    const rawKeys = Array.isArray(req.body?.keys) ? req.body.keys : []
    const normalized = rawKeys
      .map((v) => String(v || '').trim().toLowerCase())
      .filter((v) => allowedKeys.has(v))
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .slice(0, 3)
    const rawTargets = Array.isArray(req.body?.targets) ? req.body.targets : []
    const normalizedTargets = rawTargets
      .map((v) => String(v || '').trim().toLowerCase())
      .filter((v) => allowedTargets.has(v))
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .slice(0, 9)
    const rawAssignments = req.body?.assignments && typeof req.body.assignments === 'object' ? req.body.assignments : {}
    const normalizedAssignments = Object.fromEntries(
      Object.entries(rawAssignments)
        .map(([k, v]) => [String(k || '').trim().toLowerCase(), String(v || '').trim().toLowerCase()])
        .filter(([k, v]) => allowedTargets.has(k) && allowedKeys.has(v)),
    )
    await run(
      db,
      `INSERT INTO settings (key, value) VALUES ('icon_attraction_keys', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [JSON.stringify({ keys: normalized, targets: normalizedTargets, assignments: normalizedAssignments })],
    )
    return res.json({ ok: true, keys: normalized, targets: normalizedTargets, assignments: normalizedAssignments })
  }))

  return router
}
