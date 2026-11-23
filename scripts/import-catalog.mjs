import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node scripts/import-catalog.mjs /path/to/config.json");
  process.exit(1);
}

const input = JSON.parse(await readFile(resolve(inputPath), "utf8"));
if (!Array.isArray(input.main)) throw new Error("config.json must contain a main category list.");

const rootLabels = {
  favourites: "المفضلة",
  "updated-dependencic": "الاعتماديات والتحديثات",
  backupimages: "نسخ صور الأنظمة",
  panels: "اللوحات",
  plugins: "الإضافات",
  novaler: "Novaler",
  channels: "القنوات",
  feeds: "الترددات والباقات",
  bootlogos: "شعارات الإقلاع",
  spinners: "مؤشرات التحميل",
  tools: "الأدوات",
  system: "النظام",
  media: "الوسائط",
  ciefp: "إضافات Ciefp",
  multiboot: "الإقلاع المتعدد",
  softcams: "أدوات Softcam",
  backup: "النسخ الاحتياطي",
  restore: "الاستعادة",
  skins: "الواجهات والثيمات",
  images: "صور الأنظمة",
  picons: "شعارات القنوات",
  remove: "الإزالة",
};

const childLabels = {
  other_channels: "قوائم متنوعة",
  ciefp_channels: "قوائم Ciefp",
  morph883_channels: "قوائم Morph883",
  vaninbal_channels: "قوائم Vaninbal",
  openatv_skins: "OpenATV",
  teamnitro_skins: "TeamNitro",
  openbh_skins: "OpenBH",
  egami_skins: "Egami",
  openpli_py3_skins: "OpenPLi 3",
  openspa_skins: "OpenSpa",
  openvix_skins: "OpenViX",
  openpli_py2_skins: "OpenPLi 2",
  pure2_skins: "Pure2",
  display_skins: "شاشات العرض",
  "plugin-xtreamity_skins": "Xtreamity",
};

const cleanText = (value, maxLength = 180) => {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
};
const validId = (value) => typeof value === "string" && /^[a-z0-9_-]{1,64}$/i.test(value);
const categories = [];
const items = [];
const usedSections = new Set(["main"]);

function appendItems(rows, categoryId, parentCategoryId) {
  if (!Array.isArray(rows)) return 0;
  let count = 0;
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const name = cleanText(row.name || row.title);
    if (!name) continue;
    count += 1;
    items.push({
      id: `${categoryId}-${count}`,
      name,
      categoryId,
      parentCategoryId,
    });
  }
  return count;
}

for (const root of input.main) {
  if (!root || typeof root !== "object" || !validId(root.section)) continue;
  const rootId = root.section;
  const rows = input[rootId];
  if (!Array.isArray(rows)) continue;
  usedSections.add(rootId);

  const descriptors = rows.filter((row) => row && typeof row === "object" && validId(row.section) && typeof row.title === "string");
  const isSubcategoryList = rows.length > 0 && descriptors.length === rows.length;
  const rootCategory = {
    id: rootId,
    title: rootLabels[rootId] || cleanText(root.title) || rootId,
    parentId: null,
    count: 0,
  };
  categories.push(rootCategory);

  if (isSubcategoryList) {
    for (const descriptor of descriptors) {
      const childId = descriptor.section;
      const childRows = input[childId];
      if (!Array.isArray(childRows)) continue;
      usedSections.add(childId);
      const childCategory = {
        id: childId,
        title: childLabels[childId] || cleanText(descriptor.title) || childId,
        parentId: rootId,
        count: 0,
      };
      childCategory.count = appendItems(childRows, childId, rootId);
      categories.push(childCategory);
      rootCategory.count += childCategory.count;
    }
  } else {
    rootCategory.count = appendItems(rows, rootId, rootId);
  }
}

for (const [sectionId, rows] of Object.entries(input)) {
  if (usedSections.has(sectionId) || !validId(sectionId) || !Array.isArray(rows)) continue;
  const category = {
    id: sectionId,
    title: childLabels[sectionId] || rootLabels[sectionId] || sectionId.replace(/[_-]+/g, " "),
    parentId: null,
    count: appendItems(rows, sectionId, sectionId),
  };
  categories.push(category);
}

const catalog = {
  version: 1,
  source: "config.json — أسماء وتصنيفات فقط",
  totals: {
    items: items.length,
    categories: categories.length,
    rootCategories: categories.filter((category) => category.parentId === null).length,
  },
  categories,
  items,
};

const outputPath = resolve(projectRoot, "public/catalog-data.json");
await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(`Wrote ${catalog.totals.items} display-only entries across ${catalog.totals.categories} categories to ${outputPath}`);
