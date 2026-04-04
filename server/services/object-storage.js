import { env } from 'process'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

const objectStorageVars = [
  'OBJECT_STORAGE_ENDPOINT',
  'OBJECT_STORAGE_BUCKET',
  'OBJECT_STORAGE_ACCESS_KEY',
  'OBJECT_STORAGE_SECRET_KEY',
  'OBJECT_STORAGE_PUBLIC_URL',
]

let client = null

function trim(value) {
  return String(value || '').trim()
}

function hasObjectStorageEnv() {
  return objectStorageVars.every((key) => Boolean(trim(env[key])))
}

export function isObjectStorageConfigured() {
  return hasObjectStorageEnv()
}

function getBucketName() {
  return trim(env.OBJECT_STORAGE_BUCKET)
}

function getPublicUrl() {
  const raw = trim(env.OBJECT_STORAGE_PUBLIC_URL)
  if (!raw) return null
  return raw.replace(/\/+$/, '')
}

function normalizeStorageKey(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  return raw.replace(/^\/+/, '')
}

function getClient() {
  if (client) return client
  if (!hasObjectStorageEnv()) return null
  const endpoint = trim(env.OBJECT_STORAGE_ENDPOINT)
  const region = trim(env.OBJECT_STORAGE_REGION) || undefined
  const forcePath = ['1', 'true', 'yes'].includes(String(trim(env.OBJECT_STORAGE_FORCE_PATH_STYLE) || '').toLowerCase())
  client = new S3Client({
    endpoint,
    region,
    forcePathStyle: forcePath,
    credentials: {
      accessKeyId: trim(env.OBJECT_STORAGE_ACCESS_KEY),
      secretAccessKey: trim(env.OBJECT_STORAGE_SECRET_KEY),
    },
  })
  return client
}

async function ensureClient() {
  const s3 = getClient()
  if (!s3) throw new Error('OBJECT_STORAGE_UNCONFIGURED')
  return s3
}

export async function uploadObject(storageKey, buffer, contentType) {
  const key = normalizeStorageKey(storageKey)
  if (!key) throw new Error('INVALID_STORAGE_KEY')
  const s3 = await ensureClient()
  await s3.send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  )
  const publicUrl = getPublicUrl()
  return {
    storageKey: key,
    externalUrl: publicUrl ? `${publicUrl}/${encodeURI(key)}` : null,
  }
}

export async function deleteObjectByStorageKey(storageKey) {
  const key = normalizeStorageKey(storageKey)
  if (!key) return
  const s3 = getClient()
  if (!s3) return
  await s3.send(
    new DeleteObjectCommand({
      Bucket: getBucketName(),
      Key: key,
    }),
  )
}

export function buildExternalUrl(storageKey) {
  const key = normalizeStorageKey(storageKey)
  const publicUrl = getPublicUrl()
  if (!publicUrl || !key) return null
  return `${publicUrl}/${encodeURI(key)}`
}
