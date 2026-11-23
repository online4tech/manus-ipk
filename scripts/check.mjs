import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const catalogHtml = await readFile(new URL("../public/catalog.html", import.meta.url), "utf8");
const catalogScript = await readFile(new URL("../public/catalog.js", import.meta.url), "utf8");
const commandsHtml = await readFile(new URL("../public/commands.html", import.meta.url), "utf8");
const commandsScript = await readFile(new URL("../public/commands.js", import.meta.url), "utf8");
const catalog = JSON.parse(await readFile(new URL("../public/catalog-data.json", import.meta.url), "utf8"));
const commandData = JSON.parse(await readFile(new URL("../public/commands-data.json", import.meta.url), "utf8"));
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
  ["commands link from landing page", /href="\.\/commands\.html"/],
];

const requiredCatalog = [
  ["Arabic language and RTL direction", /<html lang="ar" dir="rtl">/],
  ["catalog title", /<title>كتالوج Manus IPK/],
  ["catalog search input", /id="catalog-search"/],
  ["catalog category list", /id="catalog-categories"/],
  ["read-only safety notice", /لا تثبّت عناصر على جهازك ولا تشغّل أوامر طرفية/],
  ["relative catalog stylesheet", /href="\.\/catalog\.css"/],
  ["relative catalog script", /src="\.\/catalog\.js"/],
  ["commands page link", /href="\.\/commands\.html"/],
];

const requiredCommands = [
  ["Arabic language and RTL direction", /<html lang="ar" dir="rtl">/],
  ["commands page title", /<title>أوامر التثبيت/],
  ["search input", /id="command-search"/],
  ["category list", /id="command-categories"/],
  ["copy-only safety statement", /زر النسخ ينسخ النص فقط/],
  ["unencrypted HTTP and TLS safety warning", /HTTP غير مشفّر[\s\S]*تجاوز فحص TLS/],
  ["relative commands stylesheet", /href="\.\/commands\.css"/],
  ["relative commands script", /src="\.\/commands\.js"/],
];

const failures = [
  ...requiredHome.filter(([, pattern]) => !pattern.test(html)).map(([name]) => `home: ${name}`),
  ...requiredCatalog.filter(([, pattern]) => !pattern.test(catalogHtml)).map(([name]) => `catalog: ${name}`),
  ...requiredCommands.filter(([, pattern]) => !pattern.test(commandsHtml)).map(([name]) => `commands page: ${name}`),
];

if (!/fetch\("\.\/catalog-data\.json"\)/.test(catalogScript)) failures.push("catalog data endpoint");
if (/innerHTML|outerHTML|insertAdjacentHTML/.test(catalogScript)) failures.push("catalog rendering avoids HTML injection APIs");
if (!/fetch\("\.\/commands-data\.json"\)/.test(commandsScript)) failures.push("commands data endpoint");
if (!/navigator\.clipboard\.writeText\(command\)/.test(commandsScript)) failures.push("copy uses clipboard without executing commands");
if (/innerHTML|outerHTML|insertAdjacentHTML|\beval\s*\(|\bnew\s+Function\s*\(/.test(commandsScript)) {
  failures.push("commands rendering avoids HTML injection and execution APIs");
}

if (!Array.isArray(catalog.categories) || catalog.categories.length !== catalog.totals?.categories) {
  failures.push("catalog category structure");
}
if (!Array.isArray(catalog.items) || catalog.items.length !== catalog.totals?.items || catalog.items.length === 0) {
  failures.push("catalog item structure");
}
const forbiddenCatalogKeys = new Set(["cmd", "remove_cmd", "path", "icon"]);
function containsForbiddenCatalogFields(value) {
  if (Array.isArray(value)) return value.some(containsForbiddenCatalogFields);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => forbiddenCatalogKeys.has(key) || containsForbiddenCatalogFields(child));
}
if (containsForbiddenCatalogFields(catalog)) failures.push("raw shell/path/icon fields are excluded from public catalog data");
const catalogCategoryIds = new Set(catalog.categories.map((category) => category.id));
if (catalog.items.some((item) => !item.name || !catalogCategoryIds.has(item.categoryId) || !catalogCategoryIds.has(item.parentCategoryId))) {
  failures.push("catalog items reference valid categories");
}

if (!Array.isArray(commandData.categories) || !Array.isArray(commandData.commands)
  || commandData.commands.length !== commandData.totals?.commands
  || commandData.categories.length !== commandData.totals?.categories
  || commandData.commands.length === 0) {
  failures.push("install command data structure and totals");
}
const commandCategoryIds = new Set(commandData.categories.map((category) => category.id));
const allowedCommandKeys = new Set(["id", "name", "categoryId", "command"]);
const removalPattern = /\b(?:uninstall|remove|purge|delete)\b|\b(?:opkg|ipkg|apt(?:-get)?|dnf|yum|rpm)\s+(?:-y\s+)?(?:remove|purge|erase)\b|\brm\s+-r\w*\b/i;
const sensitivePatterns = [
  /(?:password|passwd|passphrase|token|api[_-]?key|secret|authorization)\s*[:=]\s*[^\s;|&]+/i,
  /https?:\/\/[^/\s:@]+:[^/\s@]+@/i,
  /\b(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}\b|\bAKIA[0-9A-Z]{16}\b|\bsk-[A-Za-z0-9_-]{24,}\b|\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\./i,
];
const commandIds = new Set();
for (const entry of commandData.commands) {
  const keys = Object.keys(entry);
  if (keys.some((key) => !allowedCommandKeys.has(key)) || keys.length !== allowedCommandKeys.size) {
    failures.push("public command entries contain only id, name, categoryId and command");
    break;
  }
  if (!entry.id || commandIds.has(entry.id) || !entry.name || !entry.command
    || !commandCategoryIds.has(entry.categoryId) || entry.categoryId === "remove") {
    failures.push("commands have unique ids, valid labels and non-removal categories");
    break;
  }
  commandIds.add(entry.id);
  if (removalPattern.test(entry.command) || /[\r\n\u0000]/.test(entry.command) || entry.command.length > 1200
    || sensitivePatterns.some((pattern) => pattern.test(entry.command))) {
    failures.push("public command data excludes removal, malformed or sensitive commands");
    break;
  }
}
if (commandData.categories.some((category) => category.id === "remove" || !catalogCategoryIds.has(category.id))) {
  failures.push("commands use valid non-removal catalog categories");
}

const routePaths = new Set(Array.isArray(routes.routes) ? routes.routes.map((route) => route.path) : []);
if (!routePaths.has("/") || !routePaths.has("/catalog.html") || !routePaths.has("/commands.html")) {
  failures.push("route manifest includes home, catalog and commands pages");
}

if (failures.length > 0) {
  console.error(`Validation failed: ${failures.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log(`Valid: landing page, display-only catalog (${catalog.items.length} entries), and ${commandData.commands.length} copy-only install commands.`);
}
