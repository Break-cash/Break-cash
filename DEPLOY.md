# دليل النشر | Deployment Guide

هذا الملف مرجع تشغيلي فقط. لا ينفذ أي نشر تلقائيًا.

## المسار المعتمد

- اعتمد هذا المجلد فقط كمصدر العمل الحالي.
- لا تنشر من نسخ أرشيفية أو مجلدات تجريبية أخرى.

## أوامر أساسية

```bash
npm install
npm run build
npm run start:prod
```

## متغيرات الإنتاج المطلوبة

- `NODE_ENV=production`
- `DATABASE_URL`
- `JWT_SECRET`
- `OWNER_EMAIL`
- `OWNER_PASSWORD`

## متغيرات اختيارية

- `SENTRY_DSN`
- `SENTRY_TRACES_SAMPLE_RATE`
- `VITE_SENTRY_DSN`
- `VITE_SENTRY_TRACES_SAMPLE_RATE`
- `UPTIME_PING_TOKEN`

## فحص الصحة

بعد تشغيل التطبيق، يمكن التحقق عبر:

```bash
curl http://localhost:5174/api/health/live
curl http://localhost:5174/api/health/ready
curl http://localhost:5174/api/health
```

## ملاحظات إنتاجية

- استخدم PostgreSQL في الإنتاج.
- لا تعتمد على SQLite في بيئة حقيقية.
- فعّل مفاتيح Sentry عند الحاجة للمراقبة.
- راجع ملف `vercel.json` وملف `railway.json` قبل أي نشر فعلي.

## Deployment Notes

- Build output is generated in `dist/`.
- The Express server serves the built frontend in production mode.
- Validate environment variables before any real deployment.
- This repository is now optimized for a cleaner production build with smaller frontend entry chunks.
