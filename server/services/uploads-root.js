import path from 'node:path'

/**
 * Absolute root for on-disk uploads (avatars, KYC, proofs, ads, etc.).
 * Set UPLOADS_ROOT on hosts with a persistent volume (e.g. Render Disk mounted at /var/data/uploads).
 * Default: <cwd>/server/uploads
 */
export function getUploadsRoot() {
  const raw = process.env.UPLOADS_ROOT
  if (raw != null && String(raw).trim() !== '') {
    return path.resolve(String(raw).trim())
  }
  return path.join(process.cwd(), 'server', 'uploads')
}
