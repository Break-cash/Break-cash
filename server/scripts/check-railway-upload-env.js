#!/usr/bin/env node
/**
 * Validates env for API deploy (Railway etc.): DB + optional R2/S3 uploads.
 * Run: npm run railway:check-uploads
 * Exit 1 if required vars for chosen mode are missing.
 */
import 'dotenv/config'

function trim(name) {
  return String(process.env[name] || '').trim()
}

const errors = []
const warnings = []

if (!trim('DATABASE_URL')) {
  errors.push('DATABASE_URL مفقود (سلسلة اتصال PostgreSQL).')
}

const hasPublic = Boolean(trim('OBJECT_STORAGE_PUBLIC_URL'))
const hasBucket = Boolean(trim('OBJECT_STORAGE_BUCKET'))
const hasKey = Boolean(trim('OBJECT_STORAGE_ACCESS_KEY'))
const hasSecret = Boolean(trim('OBJECT_STORAGE_SECRET_KEY'))
const objectStorageAny = hasPublic || hasBucket || hasKey || hasSecret
const objectStorageOk = hasPublic && hasBucket && hasKey && hasSecret

if (objectStorageAny && !objectStorageOk) {
  if (!hasPublic) errors.push('OBJECT_STORAGE_PUBLIC_URL مفقود.')
  if (!hasBucket) errors.push('OBJECT_STORAGE_BUCKET مفقود.')
  if (!hasKey) errors.push('OBJECT_STORAGE_ACCESS_KEY مفقود.')
  if (!hasSecret) errors.push('OBJECT_STORAGE_SECRET_KEY مفقود.')
}

if (objectStorageOk && !trim('OBJECT_STORAGE_ENDPOINT')) {
  warnings.push(
    'لم يُضبط OBJECT_STORAGE_ENDPOINT — إلزامي لـ Cloudflare R2 (رابط S3 API من لوحة الحساب). لـ AWS S3 فقط يمكن تركه فارغاً.',
  )
}

const uploadsRoot = trim('UPLOADS_ROOT')

if (!objectStorageOk && !uploadsRoot) {
  warnings.push(
    'لا يوجد تخزين كائنات كامل ولا UPLOADS_ROOT — الملفات على القرص المؤقت قد تُفقد عند إعادة النشر. فعّل OBJECT_STORAGE_* أو Volume + UPLOADS_ROOT.',
  )
}

if (objectStorageOk && !uploadsRoot) {
  warnings.push('موصى به على Railway: UPLOADS_ROOT=/tmp لكتابة الملفات مؤقتاً قبل الرفع إلى الـ bucket.')
}

if (warnings.length) {
  console.warn('\n[check-railway-upload-env] تحذيرات:')
  for (const w of warnings) console.warn(' -', w)
}

if (errors.length) {
  console.error('\n[check-railway-upload-env] أخطاء:')
  for (const e of errors) console.error(' -', e)
  console.error('\nاستخدم railway.variables.template كقائمة للنسخ إلى Railway → Variables.\n')
  process.exit(1)
}

const mode = objectStorageOk ? 'تخزين R2/S3 مفعّل' : 'بدون R2/S3 — اعتمد على القرص/Volume'
console.log('[check-railway-upload-env] OK —', mode)
process.exit(0)
