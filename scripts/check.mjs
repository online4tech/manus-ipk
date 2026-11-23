import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const catalogHtml = await readFile(new URL("../public/catalog.html", import.meta.url), "utf8");
const catalogScript = await readFile(new URL("../public/catalog.js", import.meta.url), "utf8");
const catalog = JSON.parse(await readFile(new URL("../public/catalog-data.json", import.meta.url), "utf8"));
const routes = JSON.parse(await readFile(new URL("../public/manus-routes.json", import.meta.url), "utf8"));
const requiredHome = [
  ["Arabic language and RTL direction", /<html lang="ar" dir="rtl">/],
  ["page title", /<title>Manus IPK/],
  ["features section", /id="features"/],
  ["installation section", /id="install"/],
  ["compatibility section", /id="compatibility"/],
  ["FAQ section", /id="faq"/],
  ["GitHub repository link", /https:\/\/github\.com\/online4tech\/manus-ipk/],
  ["responsive viewport", /name="viewport"/],
  ["relative stylesheet path for project Pages", /href="\.\/styles\.css"/],
  ["relative script path for project Pages", /src="\.\/script\.js"/],
  ["catalog link from landing page", /href="\.\/catalog\.html"/],
];

const requiredCatalog = [
  ["Arabic language and RTL direction", /<html lang="ar" dir="rtl">/],
  ["catalog title", /<title>كتالوج Manus IPK/],
  ["catalog search input", /id="catalog-search"/],
  ["catalog category list", /id="catalog-categories"/],
  ["read-only safety notice", /لا تثبّت عناصر على جهازك ولا تشغّل أوامر طرفية/],
  ["relative catalog stylesheet", /href="\.\/catalog\.css"/],
  ["relative catalog script", /src="\.\/catalog\.js"/],
];
const failures = [
  ...requiredHome.filter(([, pattern]) => !pattern.test(html)).map(([name]) => `home: ${name}`),
  ...requiredCatalog.filter(([, pattern]) => !pattern.test(catalogHtml)).map(([name]) => `catalog: ${name}`),
];
if (!/fetch\("\.\/catalog-data\.json"\)/.test(catalogScript)) failures.push("catalog data endpoint");
if (/innerHTML|outerHTML|insertAdjacentHTML/.test(catalogScript)) failures.push("catalog rendering avoids HTML injection APIs");
if (!Array.isArray(catalog.categories) || catalog.categories.length !== catalog.totals?.categories) {
  failures.push("catalog category structure");
}
if (!Array.isArray(catalog.items) || catalog.items.length !== catalog.totals?.items || catalog.items.length === 0) {
  failures.push("catalog item structure");
}
const forbiddenKeys = new Set(["cmd", "remove_cmd", "path", "icon"]);
function containsUnsafeFields(value) {
  if (Array.isArray(value)) return value.some(containsUnsafeFields);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => forbiddenKeys.has(key) || containsUnsafeFields(child));
}
if (containsUnsafeFields(catalog)) failures.push("raw shell/path/icon fields are excluded from public catalog data");
const categoryIds = new Set(catalog.categories.map((category) => category.id));
if (catalog.items.some((item) => !item.name || !categoryIds.has(item.categoryId) || !categoryIds.has(item.parentCategoryId))) {
  failures.push("catalog items reference valid categories");
}
const routePaths = new Set(Array.isArray(routes.routes) ? routes.routes.map((route) => route.path) : []);
if (!routePaths.has("/") || !routePaths.has("/catalog.html")) failures.push("route manifest includes home and catalog pages");

if (failures.length > 0) {
  console.error(`Validation failed: ${failures.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log(`Landing page and display-only catalog are valid (${catalog.items.length} entries, ${catalog.categories.length} categories).`);
}
