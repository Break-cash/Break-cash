import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

function trimEnv(name) {
  return String(process.env[name] || '').trim()
}

export function isObjectStorageConfigured() {
  return Boolean(
    trimEnv('OBJECT_STORAGE_BUCKET') &&
      trimEnv('OBJECT_STORAGE_ACCESS_KEY') &&
      trimEnv('OBJECT_STORAGE_SECRET_KEY') &&
      trimEnv('OBJECT_STORAGE_PUBLIC_URL'),
  )
}

function getClient() {
  const accessKeyId = trimEnv('OBJECT_STORAGE_ACCESS_KEY')
  const secretAccessKey = trimEnv('OBJECT_STORAGE_SECRET_KEY')
  const endpoint = trimEnv('OBJECT_STORAGE_ENDPOINT') || undefined
  const region = trimEnv('OBJECT_STORAGE_REGION') || 'auto'
  const forcePathStyle =
    trimEnv('OBJECT_STORAGE_FORCE_PATH_STYLE') === '1' || trimEnv('OBJECT_STORAGE_FORCE_PATH_STYLE') === 'true'
  return new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    ...(forcePathStyle ? { forcePathStyle: true } : {}),
  })
}

/** Public URL used by browsers (R2 public bucket, custom domain, or CloudFront). */
export function buildObjectPublicUrl(storageKey) {
  const base = trimEnv('OBJECT_STORAGE_PUBLIC_URL').replace(/\/$/, '')
  if (!base) return null
  const key = String(storageKey || '').replace(/^\/+/, '')
  const encoded = key
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')
  return `${base}/${encoded}`
}

export async function putObjectFromBuffer(storageKey, body, contentType) {
  if (!isObjectStorageConfigured()) return null
  const bucket = trimEnv('OBJECT_STORAGE_BUCKET')
  const client = getClient()
  const key = String(storageKey || '').replace(/^\/+/, '')
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: String(contentType || 'application/octet-stream').trim() || 'application/octet-stream',
    }),
  )
  return buildObjectPublicUrl(key)
}

export async function deleteObjectByStorageKey(storageKey) {
  if (!isObjectStorageConfigured()) return
  const bucket = trimEnv('OBJECT_STORAGE_BUCKET')
  const key = String(storageKey || '').replace(/^\/+/, '')
  if (!key) return
  const client = getClient()
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  } catch (e) {
    console.warn('[object-storage] delete failed', key, e instanceof Error ? e.message : String(e))
  }
}
