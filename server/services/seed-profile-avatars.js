import fs from 'node:fs/promises'
import path from 'node:path'
import { get, run } from '../db.js'
import { buildUserAvatarUrl } from './user-avatars.js'

export const SEEDED_PROFILE_AVATAR_ASSIGNMENTS = [
  { userId: 13, fileName: 'emarati.jpeg', originalName: 'اماراتي.jpeg' },
  { userId: 3002, fileName: 'emarati-3.jpeg', originalName: 'اماراتي 3.jpeg' },
  { userId: 3009, fileName: 'abu-saud.jpeg', originalName: 'ابو سعود.jpeg' },
]

function guessMimeType(filePath) {
  const ext = path.extname(String(filePath || '')).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.svg') return 'image/svg+xml'
  return 'image/jpeg'
}

async function readFileAsBase64(filePath) {
  const fileBuffer = await fs.readFile(filePath)
  return fileBuffer.toString('base64')
}

export async function assignSeededProfileAvatar(db, assignment) {
  const user = await get(
    db,
    `SELECT id
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [assignment.userId],
  )
  if (!user) {
    return { userId: assignment.userId, status: 'missing_user' }
  }

  const absolutePath = path.join(process.cwd(), 'server', 'seed-assets', 'avatars', assignment.fileName)
  const publicUrl = `/uploads/avatars/seed/${assignment.fileName}`
  const mimeType = guessMimeType(absolutePath)
  const contentBase64 = await readFileAsBase64(absolutePath)

  await run(
    db,
    `UPDATE users
     SET avatar_path = ?,
         avatar_blob_base64 = ?,
         avatar_blob_mime_type = ?
     WHERE id = ?`,
    [publicUrl, contentBase64, mimeType, assignment.userId],
  )

  return {
    userId: assignment.userId,
    status: 'updated',
    avatarUrl: buildUserAvatarUrl(assignment.userId, publicUrl, true),
  }
}

export async function syncSeededProfileAvatars(db) {
  const results = []
  for (const assignment of SEEDED_PROFILE_AVATAR_ASSIGNMENTS) {
    results.push(await assignSeededProfileAvatar(db, assignment))
  }
  return results
}
