# Manus IPK

صفحة هبوط عربية RTL لمشروع Manus IPK المرتبط بإضافات Enigma2. توضح الصفحة طريقة التحقق من التوافق والتثبيت، وتتجنب ذكر أجهزة أو إصدارات مدعومة ما لم تُوثق في ملاحظات الحزمة.

## التشغيل والبناء محليًا

يتطلب المشروع Node.js 20 أو أحدث وPython 3 للمعاينة المحلية. لا توجد حزم npm خارجية.

```bash
npm ci
npm test
npm run build
npm run dev
```

يفتح خادم المعاينة على المنفذ 3000. ينتج أمر البناء الملفات الجاهزة للاستضافة في `dist/`.

## CI وCD

يفحص سير `.github/workflows/ci.yml` الصفحة عند الدفع إلى `main` وعند فتح أو تحديث Pull Request يستهدف `main`. ينفذ `npm ci` ثم `npm test` ثم `npm run build`، ويرفع ناتج `dist/` كـ artifact لمدة 7 أيام.

ينشر سير `.github/workflows/deploy-pages.yml` الموقع تلقائيًا إلى GitHub Pages عند الدفع إلى `main`، ويمكن تشغيله يدويًا من تبويب **Actions**. لا ينشر الـPull Request مباشرة. يحتاج إلى إعداد GitHub Pages مرة واحدة: افتح **Settings → Pages → Build and deployment** واختر **GitHub Actions** كمصدر النشر. لا يحتاج المشروع إلى أسرار أو رموز وصول.

الموقع ثابت ويُبنى بلا خادم أو قاعدة بيانات. GitHub Pages متاح للمستودعات العامة ضمن GitHub Free، مع مراعاة حدود الاستخدام الرسمية للخدمة. [مستند GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

## محتوى الصفحة

- `public/index.html` — بنية الصفحة والنص العربي.
- `public/styles.css` — الهوية البصرية والتجاوب.
- `public/script.js` — قائمة الهاتف وسنة حقوق النشر.
- `public/manus-routes.json` — تعريف المسارات لمعاينة Manus.
- `scripts/check.mjs` — فحوصات بنيوية سريعة.
- `scripts/build.mjs` — نسخ ملفات الموقع إلى `dist/`.
