import { openDb } from '../db.js'
import { syncSeededProfileAvatars } from '../services/seed-profile-avatars.js'

async function main() {
  const db = await openDb()
  const results = await syncSeededProfileAvatars(db)
  for (const result of results) {
    console.log(JSON.stringify(result))
  }
}

main().catch((error) => {
  console.error('[assign-seed-profile-avatars] failed', error)
  process.exitCode = 1
})
