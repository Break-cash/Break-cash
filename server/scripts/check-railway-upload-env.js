import 'dotenv/config'

function readEnv(name) {
  return String(process.env[name] || '').trim()
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

const databaseUrl = readEnv('DATABASE_URL')
if (!databaseUrl) {
  fail('DATABASE_URL is missing in the current environment.')
}

const objectStorageKeys = [
  'OBJECT_STORAGE_ENDPOINT',
  'OBJECT_STORAGE_REGION',
  'OBJECT_STORAGE_BUCKET',
  'OBJECT_STORAGE_ACCESS_KEY',
  'OBJECT_STORAGE_SECRET_KEY',
  'OBJECT_STORAGE_PUBLIC_URL',
]

const presentObjectStorageKeys = objectStorageKeys.filter((key) => Boolean(readEnv(key)))
if (presentObjectStorageKeys.length > 0 && presentObjectStorageKeys.length !== objectStorageKeys.length) {
  const missing = objectStorageKeys.filter((key) => !readEnv(key))
  fail(`Object storage is partially configured. Missing: ${missing.join(', ')}`)
}

if (presentObjectStorageKeys.length === objectStorageKeys.length) {
  const publicUrl = readEnv('OBJECT_STORAGE_PUBLIC_URL')
  if (publicUrl.endsWith('/')) {
    fail('OBJECT_STORAGE_PUBLIC_URL must not end with a trailing slash.')
  }
  console.log('Object storage configuration is complete.')
} else {
  console.log('Object storage configuration is not set. Local disk uploads will be used.')
}

const uploadsRoot = readEnv('UPLOADS_ROOT')
if (uploadsRoot) {
  console.log(`UPLOADS_ROOT is set to: ${uploadsRoot}`)
} else {
  console.log('UPLOADS_ROOT is not set. The server will use the default uploads directory.')
}

console.log('DATABASE_URL is set.')
console.log('Upload environment check passed.')
