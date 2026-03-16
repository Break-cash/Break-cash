# نشر Break cash للإنتاج

## الطريقة 1: سيرفر واحد (Docker) — موصى بها

يعمل الواجهة والـ API من نفس السيرفر. مناسب لـ VPS أو Railway أو Render أو أي مضيف يدعم Docker.

### متطلبات

- Docker مثبت على جهازك أو على السيرفر
- قاعدة بيانات PostgreSQL (مثلاً من Railway أو Supabase أو أي مضيف)
- ملف `.env` للإنتاج (انسخ من `.env.example` وعدّل القيم)

### خطوات النشر على Railway

1. سجّل دخولك إلى [railway.app](https://railway.app) وربط مستودع GitHub لمشروعك.
2. أضف خدمة **PostgreSQL** من القائمة ثم انسخ `DATABASE_URL` من Variables.
3. أضف خدمة جديدة واختر **Deploy from GitHub** ثم اختر المشروع.
4. في الإعدادات:
   - **Build Command:** (اتركه فارغاً أو `docker build -t app .`)
   - **Start Command:** (اتركه فارغاً إذا استخدمت Dockerfile)
   - **Root Directory:** المجلد الجذر للمشروع
   - إذا كان Railway يكتشف Dockerfile تلقائياً، سيُبنى ويُشغّل من Docker.
5. في **Variables** أضف كل متغيرات `.env` (خصوصاً `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`, `PORT`).
6. من **Settings** فعّل **Public Networking** واختر Generate Domain لتحصل على رابط مثل `https://xxx.up.railway.app`.

### خطوات النشر على Render

1. ادخل إلى [render.com](https://render.com) وربط مستودع GitHub.
2. **New → PostgreSQL** لإنشاء قاعدة بيانات، ثم انسخ **Internal Database URL**.
3. **New → Web Service**، اختر المستودع.
4. الإعدادات:
   - **Environment:** Docker
   - **Build Command:** (يُستخدم Dockerfile تلقائياً)
   - **Start Command:** (من Dockerfile)
5. في **Environment** أضف المتغيرات: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`, وباقي ما في `.env.example`.
6. احفظ ثم انتظر انتهاء الـ Build والـ Deploy. ستظهر لك عنوان مثل `https://xxx.onrender.com`.

### تشغيل Docker محلياً (للتجربة)

```bash
# بناء الصورة
docker build -t breakcash .

# تشغيل (غيّر DATABASE_URL حسب بيئتك)
docker run --rm -p 5174:5174 \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="your-secret" \
  breakcash
```

ثم افتح المتصفح على: `http://localhost:5174`

---

## الطريقة 2: بدون Docker (بناء يدوي على VPS)

مفيدة إذا كان السيرفر يعمل عليه Node.js فقط بدون Docker.

```bash
# على السيرفر (مثلاً Ubuntu)
cd /path/to/breakcash.cash
npm ci
npm run build

# تشغيل بالإنتاج (يُفضّل استخدام pm2)
export NODE_ENV=production
export PORT=5174
# اضبط DATABASE_URL و JWT_SECRET وغيرها في .env
npm start
```

مع **PM2** لبقاء العملية تعمل بعد إغلاق الطرفية:

```bash
npm install -g pm2
NODE_ENV=production pm2 start server/index.js --name breakcash
pm2 save
pm2 startup
```

---

## الطريقة 3: واجهة على Vercel + API منفصل

لديك بالفعل `vercel.json` يعيد توجيه `/api` إلى `https://api.breakcash.cash`.

- **الواجهة:** انشر المشروع على [Vercel](https://vercel.com) (ربط المستودع ثم Deploy). Vercel سيبني من `vite build` ويخدم الملفات الثابتة، والطلبات إلى `/api` ستُحوّل إلى `api.breakcash.cash`.
- **الـ API:** انشر السيرفر (مجلد `server` + تشغيل `node server/index.js` بعد ضبط المتغيرات) على أي مضيف (Railway / Render / VPS) وربط النطاق `api.breakcash.cash` به.

تأكد أن نطاق الواجهة (مثلاً `breakcash.cash`) مضبوط في Vercel، وأن `api.breakcash.cash` يشير إلى مضيف الـ API.

---

## ملخص المتغيرات المهمة للإنتاج

| المتغير | وصف |
|--------|-----|
| `NODE_ENV` | `production` |
| `PORT` | منفذ التطبيق (غالباً 5174 أو ما يعطيه المضيف) |
| `DATABASE_URL` | رابط اتصال PostgreSQL |
| `JWT_SECRET` | سري قوي لتوقيع الجلسات |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | حساب المدير |
| `OWNER_EMAIL` / `OWNER_PASSWORD` | حساب المالك |

أبقِ `ALLOW_DEV_CODE=0` في الإنتاج. للإيميل وSMS وSentry استخدم القيم من `.env.example` حسب الحاجة.
