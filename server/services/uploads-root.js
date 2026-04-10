import fs from 'node:fs/promises'
import path from 'node:path'

const computedRoot = (process.env.UPLOADS_ROOT || '').trim() || path.join(process.cwd(), 'server', 'uploads')
let ensurePromise = null

export function getUploadsRoot() {
  return computedRoot
}

export async function ensureUploadsRoot() {
  if (!ensurePromise) {
    ensurePromise = fs.mkdir(getUploadsRoot(), { recursive: true })
  }
  return ensurePromise
}

export async function ensureUploadDir(...segments) {
  const first = segments[0]
  const dir = typeof first === 'string' && path.isAbsolute(first)
    ? path.join(first, ...segments.slice(1))
    : path.join(getUploadsRoot(), ...segments)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

export function resolveUploadPath(storageKey) {
  if (path.isAbsolute(storageKey)) return storageKey
  return path.join(getUploadsRoot(), storageKey)
}
