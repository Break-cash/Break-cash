# نسخة المشروع لـ Codex / Project snapshot for Codex

- **المستودع / Repository:** https://github.com/Break-cash/Break-cash  
- **الفرع / Branch:** `main`  
- **آخر commit:** `0e99835` — `chore(vercel): redirect www.breakcash.cash to breakcash.cash`  
- **المسار المحلي / Local path:** `c:\Users\bffh1\Desktop\تطبيق تداول\breakcash.cash`

## أهم التعديلات في هذه النسخة

- توجيه Vercel: `www.breakcash.cash` → `breakcash.cash`
- إزالة `require` من `App.tsx` لإصلاح بناء TypeScript
- Layout موحد للمالك (Owner) مع sidebar و nav و permissions و audit table
- تمرير مسارات `/owner/*` عبر حارس موحد
- توحيد wallet summary بين الصفحة الرئيسية وصفحة المحفظة
- رسالة خطأ شبكة واضحة في تسجيل الدخول بدل "Failed to fetch"
- حراسة نتائج `Promise.allSettled` في Profile لتفادي TS18048

**التقنيات:** React, TypeScript, Vite, backend Node/Express (في نفس المستودع).
