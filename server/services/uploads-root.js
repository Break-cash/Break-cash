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
  const dir = path.join(getUploadsRoot(), ...segments)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

export function resolveUploadPath(storageKey) {
  return path.join(getUploadsRoot(), storageKey)
}
