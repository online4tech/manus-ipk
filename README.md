# Manus IPK

صفحة هبوط عربية RTL لمشروع Manus IPK المرتبط بإضافات Enigma2، مع كتالوج تصنيفي قابل للبحث وصفحة منفصلة تعرض أوامر التثبيت للنسخ فقط. لا ينفّذ الموقع الأوامر ولا يتصل بالرسيفر؛ راجع مصدر الأمر وتوافقه قبل نسخه.

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

يستخرج المستورد أسماء العناصر والتصنيفات فقط، ويستبعد أوامر التثبيت والإزالة والمسارات وأسماء الأيقونات.

## أوامر التثبيت

تُبنى بيانات صفحة الأوامر بشكل منفصل عبر:

```bash
node scripts/import-catalog-commands.mjs /path/to/config.json
```

يستخرج المستورد حقول `cmd` فقط، ويستبعد قسم الإزالة والأوامر ذات دلالات الإزالة أو المحتوى الحساس أو غير الصالح للعرض. لا يقرأ المستورد حقول `remove_cmd` إلى البيانات العامة. الأوامر المعروضة نصوص ثابتة؛ زر النسخ يرسل النص إلى الحافظة فقط، ولا يوجد طرفية أو تشغيل تلقائي أو اتصال بالرسيفر. من بين 807 أوامر، يستخدم 74 أمرًا HTTP غير مشفّر ويحمل 133 مؤشرًا على تجاوز فحص TLS؛ راجع المصدر ومحتوى السكريبت والتوافق قبل النسخ. ملف `config.json` نفسه لا يُنشر.

## CI وCD

يفحص سير `.github/workflows/ci.yml` الصفحة والكتالوج والأوامر عند الدفع إلى `main` وعند فتح أو تحديث Pull Request يستهدف `main`. ينفذ `npm ci` ثم `npm test` ثم `npm run build`، ويرفع ناتج `dist/` كـ artifact لمدة 7 أيام.

ينشر سير `.github/workflows/deploy-pages.yml` الموقع تلقائيًا إلى GitHub Pages عند الدفع إلى `main`، ويمكن تشغيله يدويًا من تبويب **Actions**. مصدر Pages مضبوط على **GitHub Actions**. كما يُسجل `public/manus-routes.json` مسارات الصفحة الرئيسية والكتالوج والأوامر لمشروع Manus. لا يحتاج المشروع إلى أسرار أو رموز وصول.

الموقع ثابت ويُبنى بلا خادم أو قاعدة بيانات. رابط GitHub Pages: [online4tech.github.io/manus-ipk](https://online4tech.github.io/manus-ipk/). رابط Manus: [manusipk-wj8dxwb2.manus.space](https://manusipk-wj8dxwb2.manus.space).

## ملفات المشروع

- `public/index.html` — الصفحة الرئيسية وروابط الوصول إلى الكتالوج والأوامر.
- `public/catalog.html` و`public/catalog.js` و`public/catalog.css` — واجهة الكتالوج والبحث والتصفية.
- `public/catalog-data.json` — أسماء وتصنيفات الكتالوج فقط، دون أوامر أو مسارات تشغيل.
- `public/commands.html` و`public/commands.js` و`public/commands.css` — واجهة أوامر التثبيت، والبحث والتصفية والنسخ فقط.
- `public/commands-data.json` — أوامر التثبيت المنقّحة وبيانات التصنيف؛ دون حقول الإزالة.
- `public/manus-routes.json` — تعريف مسارات الصفحات لمعاينة Manus.
- `scripts/import-catalog.mjs` — مستورد بيانات أسماء الكتالوج من ملف إعدادات محلي.
- `scripts/import-catalog-commands.mjs` — مستورد أوامر التثبيت بعد التصفية من ملف إعدادات محلي.
- `scripts/check.mjs` — فحوصات بنية الصفحات وسلامة بيانات الكتالوج والأوامر.
- `scripts/build.mjs` — نسخ ملفات الموقع إلى `dist/`.
***
