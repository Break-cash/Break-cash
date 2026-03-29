import { all, run } from '../db.js'
import { toStoredUploadReference } from './uploaded-assets.js'

async function normalizeUserAvatarReferences(db) {
  const rows = await all(
    db,
    `SELECT id, avatar_path
     FROM users
     WHERE avatar_path IS NOT NULL
       AND avatar_path <> ''`,
  )

  let updated = 0
  for (const row of rows) {
    const normalized = toStoredUploadReference(row.avatar_path)
    if (!normalized || normalized === row.avatar_path) continue
    await run(db, `UPDATE users SET avatar_path = ? WHERE id = ?`, [normalized, row.id])
    updated += 1
  }
  return updated
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
  const avatarsUpdated = await normalizeUserAvatarReferences(db)
  const kycUpdated = await normalizeKycReferences(db)
  const depositProofsUpdated = await normalizeDepositProofReferences(db)
  return {
    avatarsUpdated,
    kycUpdated,
    depositProofsUpdated,
  }
}
