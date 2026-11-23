import { access, readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [html, catalogHtml, catalogScript, legacyCommandsHtml, catalog, commandData, sections, routes] = await Promise.all([
  read("../public/index.html"),
  read("../public/catalog.html"),
  read("../public/catalog.js"),
  read("../public/commands.html"),
  read("../public/catalog-data.json").then(JSON.parse),
  read("../public/commands-data.json").then(JSON.parse),
  read("../public/catalog-sections.json").then(JSON.parse),
  read("../public/manus-routes.json").then(JSON.parse),
]);

const requiredHome = [
  ["Arabic language and RTL direction", /<html lang="ar" dir="rtl">/],
  ["page title", /<title>Manus IPK/],
  ["features section", /id="features"/],
  ["installation section", /id="install"/],
  ["compatibility section", /id="compatibility"/],
  ["FAQ section", /id="faq"/],
  ["responsive viewport", /name="viewport"/],
  ["catalog link from landing page", /href="\.\/catalog\.html"/],
];

const requiredCatalog = [
  ["Arabic language and RTL direction", /<html lang="ar" dir="rtl">/],
  ["catalog title", /<title>كتالوج Manus IPK/],
  ["catalog search input", /id="catalog-search"/],
  ["compact catalog groups", /id="catalog-categories"/],
  ["read-only notice", /لا يوجد تشغيل أو اتصال بالرسيفر/],
  ["copy risk warning", /HTTP غير مشفّر[\s\S]*تجاوز فحص TLS/],
  ["copy button live status", /id="catalog-copy-status"[^>]*aria-live="polite"/],
  ["relative catalog stylesheet", /href="\.\/catalog\.css"/],
  ["relative catalog script", /src="\.\/catalog\.js"/],
];

const failures = [
  ...requiredHome.filter(([, pattern]) => !pattern.test(html)).map(([name]) => `home: ${name}`),
  ...requiredCatalog.filter(([, pattern]) => !pattern.test(catalogHtml)).map(([name]) => `catalog: ${name}`),
];

if (/commands\.html|أوامر التثبيت|عرض أوامر التثبيت/i.test(html)) failures.push("landing page has no separate commands navigation");
if (/commands\.html|عرض أوامر التثبيت/i.test(catalogHtml)) failures.push("catalog has no link or button for a separate commands page");
if (!/http-equiv="refresh"[^>]*url=\.\/catalog\.html/.test(legacyCommandsHtml)
  || !/href="\.\/catalog\.html"/.test(legacyCommandsHtml)) {
  failures.push("legacy commands route redirects to the main catalog");
}
if (/command-grid|commands\.js|commands\.css|command-search/i.test(legacyCommandsHtml)) failures.push("legacy route does not render an independent commands page");

const publicPages = [html, catalogHtml];
if (publicPages.some((page) => /<a\b[^>]*\bhref=["']https?:\/\//i.test(page))) failures.push("public pages contain no outbound links");
if (publicPages.some((page) => /المستودع|افتح مستودع|GitHub/i.test(page))) failures.push("public pages contain no repository labels or references");

if (!/\.\/catalog-data\.json/.test(catalogScript)) failures.push("catalog data endpoint");
if (!/\.\/commands-data\.json/.test(catalogScript)) failures.push("copy command data endpoint");
if (!/\.\/catalog-sections\.json/.test(catalogScript)) failures.push("compact sections data endpoint");
if (!/navigator\.clipboard\.writeText\(command\)/.test(catalogScript)) failures.push("copy writes only to clipboard");
if (!/makeElement\("button", "command-copy-button", "انسخ الأمر"\)/.test(catalogScript)) failures.push("copy button appears inside matching catalog cards");
if (!/button\.textContent = "تم النسخ"/.test(catalogScript)) failures.push("successful copy confirms completion");
if (!/button\.classList\.add\("is-copied"\)/.test(catalogScript)) failures.push("successful copy gets visual feedback");
if (!/fallback\.hidden = true/.test(catalogScript)) failures.push("manual fallback text hides after successful copy");
if (/innerHTML|outerHTML|insertAdjacentHTML|\beval\s*\(|\bnew\s+Function\s*\(/.test(catalogScript)) {
  failures.push("catalog rendering avoids HTML injection and execution APIs");
}
if (/fetch\([^)]*https?:|WebSocket|ssh|telnet|child_process|exec\s*\(/i.test(catalogScript)) {
  failures.push("catalog never connects to or executes commands on a receiver");
}

if (!Array.isArray(catalog.categories) || catalog.categories.length !== catalog.totals?.categories) failures.push("catalog category structure");
if (!Array.isArray(catalog.items) || catalog.items.length !== catalog.totals?.items || catalog.items.length === 0) failures.push("catalog item structure");
if (!Array.isArray(sections) || sections.length !== 8) failures.push("catalog displays eight concise thematic groups");

const forbiddenCatalogKeys = new Set(["cmd", "remove_cmd", "path", "icon"]);
function containsForbiddenCatalogFields(value) {
  if (Array.isArray(value)) return value.some(containsForbiddenCatalogFields);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => forbiddenCatalogKeys.has(key) || containsForbiddenCatalogFields(child));
}
if (containsForbiddenCatalogFields(catalog)) failures.push("catalog data excludes raw shell/path/icon fields");
const catalogCategoryIds = new Set(catalog.categories.map((category) => category.id));
if (catalog.items.some((item) => !item.name || !catalogCategoryIds.has(item.categoryId) || !catalogCategoryIds.has(item.parentCategoryId))) {
  failures.push("catalog items reference valid categories");
}

const roots = new Set(catalog.categories.filter((category) => category.parentId === null).map((category) => category.id));
const groupedRoots = sections.flatMap((section) => section.categoryIds);
if (new Set(groupedRoots).size !== groupedRoots.length || roots.size !== groupedRoots.length
  || [...roots].some((root) => !groupedRoots.includes(root))) {
  failures.push("the eight concise groups cover every root catalog category exactly once");
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
  const matchesByNameAndCategory = catalog.items.filter((candidate) => candidate.name === entry.name && candidate.categoryId === entry.categoryId);
  if (matchesByNameAndCategory.length !== 1) {
    failures.push("each copy-only command matches exactly one catalog card by name and category");
    break;
  }
}
if (commandData.categories.some((category) => category.id === "remove" || !catalogCategoryIds.has(category.id))) {
  failures.push("commands use valid non-removal catalog categories");
}

const routePaths = new Set(Array.isArray(routes.routes) ? routes.routes.map((route) => route.path) : []);
if (!routePaths.has("/") || !routePaths.has("/catalog.html") || !routePaths.has("/commands.html")) {
  failures.push("route manifest includes home, catalog and legacy redirect");
}
for (const file of ["../public/commands.js", "../public/commands.css"]) {
  try {
    await access(new URL(file, import.meta.url));
    failures.push(`${file} retired along with the standalone commands page`);
  } catch {
    // Expected: separate-page assets have been removed.
  }
}

if (failures.length > 0) {
  console.error(`Validation failed: ${failures.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log(`Valid: landing page, catalog (${catalog.items.length} entries), ${sections.length} concise groups, and ${commandData.commands.length} copy-only commands mapped to catalog cards.`);
}
