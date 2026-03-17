# دليل النشر للإنتاج | Production Deployment Guide

## البنية الحالية

- **Frontend**: React + Vite (يُبنى في `dist/`)
- **Backend**: Express API على نفس الخادم
- **قواعد البيانات**: PostgreSQL (إنتاج) أو SQLite (تطوير)

---

## 1. النشر على Railway

### المتطلبات
- حساب [Railway](https://railway.app)
- قاعدة بيانات PostgreSQL (Railway أو خارجية)

### الخطوات

1. **ربط المستودع**
   - اربط مشروعك من GitHub إلى Railway
   - أو استخدم `railway link` من CLI

2. **إعداد المتغيرات البيئية** (في Railway Dashboard → Variables):

   | المتغير | مطلوب | الوصف |
   |---------|-------|-------|
   | `NODE_ENV` | نعم | `production` |
   | `PORT` | تلقائي | Railway يضبطه تلقائياً |
   | `DATABASE_URL` | نعم | رابط PostgreSQL |
   | `JWT_SECRET` | نعم | سري قوي (32+ حرف) |
   | `ADMIN_EMAIL` | نعم | بريد المدير |
   | `ADMIN_PASSWORD` | نعم | كلمة مرور المدير |
   | `OWNER_EMAIL` | نعم | بريد المالك |
   | `OWNER_PASSWORD` | نعم | كلمة مرور المالك |
   | `SENTRY_DSN` | اختياري | لمراقبة الأخطاء |
   | `UPTIME_PING_TOKEN` | اختياري | لفحص الصحة |

3. **قاعدة البيانات**
   - أنشئ خدمة PostgreSQL من Railway أو استخدم رابط خارجي
   - انسخ `DATABASE_URL` إلى المتغيرات

4. **النشر**
   - Railway يبني المشروع بـ `npm run build` ثم يشغّل `npm start`
   - Healthcheck: `/api/health`

---

## 2. النشر على Vercel (Frontend فقط)

إذا كان الـ API على `api.breakcash.cash`:

1. اربط المستودع من Vercel
2. Build Command: `npm run build`
3. Output Directory: `dist`
4. المتغيرات: `VITE_API_URL` إذا كان الـ API على دومين مختلف

ملف `vercel.json` الحالي يعيد توجيه:
- `/api/*` → `https://api.breakcash.cash/api/*`
- `/uploads/*` → `https://api.breakcash.cash/uploads/*`

---

## 3. النشر عبر Docker

```bash
# بناء الصورة
docker build -t breakcash .

# تشغيل (مع PostgreSQL خارجي)
docker run -p 5174:5174 \
  -e NODE_ENV=production \
  -e DATABASE_URL=postgresql://... \
  -e JWT_SECRET=... \
  -e ADMIN_EMAIL=... \
  -e ADMIN_PASSWORD=... \
  -e OWNER_EMAIL=... \
  -e OWNER_PASSWORD=... \
  breakcash
```

---

## 4. التحقق بعد النشر

```bash
# فحص الصحة
curl https://api.breakcash.cash/api/health

# النتيجة المتوقعة:
# {"ok":true,"db":"up","dbLatencyMs":...,"uptimeSec":...}
```

---

## 5. ملاحظات مهمة

- **لا تستخدم** `USE_SQLITE=1` في الإنتاج
- **استخدم** PostgreSQL مع `DATABASE_URL`
- **فعّل** `PGSSL=true` عند الاتصال بقاعدة بيانات خارجية
- **اضبط** `ALLOW_DEV_CODE=0` في الإنتاج
- **احفظ** نسخة احتياطية من قاعدة البيانات بانتظام
