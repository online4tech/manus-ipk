import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error("Usage: node scripts/import-catalog-commands.mjs /path/to/config.json");
  process.exit(1);
}

const source = JSON.parse(await readFile(resolve(sourcePath), "utf8"));
const catalog = JSON.parse(await readFile(resolve(projectRoot, "public/catalog-data.json"), "utf8"));
const categoryMap = new Map(catalog.categories.map((category) => [category.id, category]));
const removalPattern = /\b(?:uninstall|remove|purge|delete)\b|\b(?:opkg|ipkg|apt(?:-get)?|dnf|yum|rpm)\s+(?:-y\s+)?(?:remove|purge|erase)\b|\brm\s+-r\w*\b/i;
const secretPatterns = [
  /(?:password|passwd|passphrase|token|api[_-]?key|secret|authorization)\s*[:=]\s*[^\s;|&]+/i,
  /https?:\/\/[^/\s:@]+:[^/\s@]+@/i,
  /\b(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}\b|\bAKIA[0-9A-Z]{16}\b|\bsk-[A-Za-z0-9_-]{24,}\b|\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\./i,
];
const commands = [];
const exclusions = { removal: 0, sensitive: 0, malformed: 0 };
const sequence = new Map();

const cleanName = (value) => typeof value === "string"
  ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 180)
  : "";
const isRemovalSection = (section, title = "") => /\b(?:remove|uninstall|delete|purge)\b|إزالة|حذف/i.test(`${section} ${title}`);

function addRows(rows, categoryId) {
  if (!Array.isArray(rows) || !categoryMap.has(categoryId) || categoryId === "remove") return;
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row) || typeof row.cmd !== "string") continue;
    const command = row.cmd.trim();
    if (!command) continue;
    if (removalPattern.test(command)) {
      exclusions.removal += 1;
      continue;
    }
    if (secretPatterns.some((pattern) => pattern.test(command))) {
      exclusions.sensitive += 1;
      continue;
    }
    if (/[\r\n\u0000]/.test(command) || command.length > 1200) {
      exclusions.malformed += 1;
      continue;
    }
    const name = cleanName(row.name || row.title);
    if (!name) {
      exclusions.malformed += 1;
      continue;
    }
    const next = (sequence.get(categoryId) || 0) + 1;
    sequence.set(categoryId, next);
    commands.push({ id: `${categoryId}-${next}`, name, categoryId, command });
  }
}

for (const root of Array.isArray(source.main) ? source.main : []) {
  if (!root || typeof root.section !== "string") continue;
  const sectionRows = source[root.section];
  if (!Array.isArray(sectionRows)) continue;
  if (isRemovalSection(root.section, root.title || "")) {
    exclusions.removal += sectionRows.filter((row) => row && typeof row.cmd === "string" && row.cmd.trim()).length;
    continue;
  }
  const descriptors = sectionRows.filter((row) => row && typeof row === "object"
    && typeof row.section === "string" && typeof row.title === "string");
  if (sectionRows.length > 0 && descriptors.length === sectionRows.length) {
    for (const child of descriptors) {
      if (isRemovalSection(child.section, child.title)) {
        const childRows = source[child.section];
        exclusions.removal += Array.isArray(childRows)
          ? childRows.filter((row) => row && typeof row.cmd === "string" && row.cmd.trim()).length
          : 0;
        continue;
      }
      addRows(source[child.section], child.section);
    }
  } else {
    addRows(sectionRows, root.section);
  }
}

const commandCounts = new Map();
for (const entry of commands) commandCounts.set(entry.categoryId, (commandCounts.get(entry.categoryId) || 0) + 1);
const categories = catalog.categories
  .filter((category) => category.id !== "remove")
  .map((category) => {
    const childIds = catalog.categories.filter((child) => child.parentId === category.id).map((child) => child.id);
    const count = (commandCounts.get(category.id) || 0)
      + childIds.reduce((sum, childId) => sum + (commandCounts.get(childId) || 0), 0);
    return { id: category.id, title: category.title, parentId: category.parentId, count };
  })
  .filter((category) => category.count > 0);
const data = {
  source: "config.json — حقل cmd فقط؛ أوامر التثبيت للعرض والنسخ دون تنفيذ",
  totals: { commands: commands.length, categories: categories.length },
  categories,
  commands,
};
await writeFile(resolve(projectRoot, "public/commands-data.json"), `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log(`Generated ${commands.length} install commands in ${categories.length} categories; excluded ${exclusions.removal} removal entries, ${exclusions.sensitive} sensitive entries, and ${exclusions.malformed} malformed entries.`);
