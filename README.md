# Manus IPK

صفحة هبوط عربية RTL لمشروع Manus IPK المرتبط بإضافات Enigma2، مع كتالوج تصنيفي قابل للبحث مستخرج من ملف الإعدادات المقدم. يعرض الكتالوج الأسماء والتقسيمات فقط؛ ولا ينفذ أوامر التثبيت أو الإزالة.

## التشغيل والبناء محليًا

يتطلب المشروع Node.js 20 أو أحدث وPython 3 للمعاينة المحلية. لا توجد حزم npm خارجية.

```bash
npm ci
npm test
npm run build
npm run dev
```

يفتح خادم المعاينة على المنفذ 3000. ينتج أمر البناء الملفات الجاهزة للاستضافة في `dist/`.

## كتالوج الإضافات

تُبنى بيانات العرض العامة من ملف `config.json` عبر:

```bash
node scripts/import-catalog.mjs /path/to/config.json
```

يستخرج المستورد أسماء العناصر والتصنيفات فقط، ويستبعد أوامر التثبيت والإزالة والمسارات وأسماء الأيقونات. لذلك لا تحتاج عملية البناء والنشر المعتادة إلى ملف `config.json` الأصلي.

## CI وCD

يفحص سير `.github/workflows/ci.yml` الصفحة والكتالوج عند الدفع إلى `main` وعند فتح أو تحديث Pull Request يستهدف `main`. ينفذ `npm ci` ثم `npm test` ثم `npm run build`، ويرفع ناتج `dist/` كـ artifact لمدة 7 أيام.

ينشر سير `.github/workflows/deploy-pages.yml` الموقع تلقائيًا إلى GitHub Pages عند الدفع إلى `main`، ويمكن تشغيله يدويًا من تبويب **Actions**. مصدر Pages مضبوط على **GitHub Actions**. كما يُسجل `public/manus-routes.json` مساري الصفحة الرئيسية والكتالوج لمشروع Manus. لا يحتاج المشروع إلى أسرار أو رموز وصول.

الموقع ثابت ويُبنى بلا خادم أو قاعدة بيانات. رابط GitHub Pages: [online4tech.github.io/manus-ipk](https://online4tech.github.io/manus-ipk/). رابط Manus: [manusipk-wj8dxwb2.manus.space](https://manusipk-wj8dxwb2.manus.space).

## ملفات المشروع

- `public/index.html` — الصفحة الرئيسية العربية وروابط الوصول إلى الكتالوج.
- `public/catalog.html` و`public/catalog.js` و`public/catalog.css` — واجهة الكتالوج والبحث والتصفية.
- `public/catalog-data.json` — أسماء وتصنيفات عامة فقط، دون أوامر أو مسارات تشغيل.
- `public/manus-routes.json` — تعريف مسارات الصفحات لمعاينة Manus.
- `scripts/import-catalog.mjs` — مستورد يعيد إنشاء بيانات العرض الآمنة من ملف إعدادات محلي.
- `scripts/check.mjs` — فحوصات بنية الصفحة وسلامة حقول بيانات الكتالوج.
- `scripts/build.mjs` — نسخ ملفات الموقع إلى `dist/`.
