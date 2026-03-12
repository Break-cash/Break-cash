import fs from 'node:fs'
import path from 'node:path'
import sqlite3 from 'sqlite3'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DB_PATH = path.join(__dirname, 'db.sqlite')
const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

export function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err)
      else resolve({ lastID: this.lastID, changes: this.changes })
    })
  })
}

export function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err)
      else resolve(row)
    })
  })
}

export function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err)
      else resolve(rows)
    })
  })
}

function exec(db, sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err)
      else resolve(undefined)
    })
  })
}

async function ensureMigrationTable(db) {
  await exec(
    db,
    `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  )
}

async function applyMigrations(db) {
  if (!fs.existsSync(MIGRATIONS_DIR)) return
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b))

  for (const fileName of files) {
    const applied = await get(
      db,
      `SELECT id FROM schema_migrations WHERE name = ? LIMIT 1`,
      [fileName],
    )
    if (applied) continue

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, fileName), 'utf8')
    await exec(db, 'BEGIN')
    try {
      await exec(db, sql)
      await run(db, `INSERT INTO schema_migrations (name) VALUES (?)`, [fileName])
      await exec(db, 'COMMIT')
    } catch (error) {
      await exec(db, 'ROLLBACK')
      throw error
    }
  }
}

export async function openDb() {
  const db = new sqlite3.Database(DB_PATH)
  await exec(db, 'PRAGMA journal_mode = WAL;')
  await exec(db, 'PRAGMA foreign_keys = ON;')
  await ensureMigrationTable(db)
  await applyMigrations(db)
  return db
}

