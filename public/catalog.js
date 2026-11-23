const searchInput = document.querySelector("#catalog-search");
const categoryList = document.querySelector("#catalog-categories");
const categoryAll = document.querySelector("#category-all");
const grid = document.querySelector("#catalog-grid");
const summary = document.querySelector("#result-summary");
const loadMoreButton = document.querySelector("#load-more");
const emptyState = document.querySelector("#empty-state");
const message = document.querySelector("#catalog-message");
const copyStatus = document.querySelector("#catalog-copy-status");

if (searchInput && categoryList && grid) {
  const formatter = new Intl.NumberFormat("ar-EG");
  const pageSize = 36;
  let catalog = { categories: [], items: [] };
  let sections = [];
  let commandsById = new Map();
  let activeSection = "all";
  let visibleLimit = pageSize;
  let sortMode = "source";

  const normalize = (value) => String(value || "")
    .toLocaleLowerCase("ar")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim();

  const makeElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  const categoryMap = () => new Map(catalog.categories.map((category) => [category.id, category]));

  function rootCategoryId(categoryId, categories = categoryMap()) {
    const category = categories.get(categoryId);
    return category?.parentId || category?.id || categoryId;
  }

  function itemSectionId(item, categories = categoryMap()) {
    const rootId = rootCategoryId(item.categoryId, categories);
    return sections.find((section) => section.categoryIds.includes(rootId))?.id || "other";
  }

  function sectionCount(section) {
    if (section.id === "all") return catalog.items.length;
    const categories = categoryMap();
    return catalog.items.filter((item) => itemSectionId(item, categories) === section.id).length;
  }

  function createSectionButton(section) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-button";
    button.dataset.section = section.id;
    button.setAttribute("aria-pressed", "false");

    const name = makeElement("span", "category-name");
    name.append(makeElement("span", "category-symbol", section.title.slice(0, 1)));
    name.append(document.createTextNode(section.title));
    button.append(name, makeElement("span", "category-count", formatter.format(sectionCount(section))));
    return button;
  }

  function renderSections() {
    const fragment = document.createDocumentFragment();
    for (const section of sections) fragment.append(createSectionButton(section));
    categoryList.replaceChildren(fragment);
  }

  function selectedItems() {
    const query = normalize(searchInput.value);
    const categories = categoryMap();
    let filtered = catalog.items.filter((item) => {
      const category = categories.get(item.categoryId);
      const parent = categories.get(item.parentCategoryId);
      const command = commandsById.get(item.id);
      const inSection = activeSection === "all" || itemSectionId(item, categories) === activeSection;
      const searchable = normalize(`${item.name} ${category?.title || ""} ${parent?.title || ""} ${command?.command || ""}`);
      return inSection && (!query || searchable.includes(query));
    });

    if (sortMode === "asc") filtered = filtered.slice().sort((a, b) => a.name.localeCompare(b.name, "ar"));
    if (sortMode === "desc") filtered = filtered.slice().sort((a, b) => b.name.localeCompare(a.name, "ar"));
    return filtered;
  }

  function updateActiveButtons() {
    categoryAll.setAttribute("aria-pressed", String(activeSection === "all"));
    categoryList.querySelectorAll("button[data-section]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.section === activeSection));
    });
  }

  async function copyCommand(command, button, name, fallback) {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
      fallback.hidden = false;
      copyStatus.textContent = "تعذّر الوصول إلى الحافظة؛ يمكنك تحديد نص الأمر الظاهر أسفل البطاقة ونسخه يدويًا.";
      return;
    }
    try {
      await navigator.clipboard.writeText(command);
      fallback.hidden = true;
      button.textContent = "تم النسخ";
      button.setAttribute("aria-label", `تم نسخ أمر تثبيت ${name}`);
      button.classList.add("is-copied");
      copyStatus.textContent = `نُسخ أمر ${name} إلى الحافظة فقط؛ لم يتم تشغيله.`;
      window.setTimeout(() => {
        if (button.isConnected) {
          button.textContent = "انسخ الأمر";
          button.setAttribute("aria-label", `نسخ أمر تثبيت ${name}`);
          button.classList.remove("is-copied");
        }
      }, 1800);
    } catch {
      fallback.hidden = false;
      copyStatus.textContent = "تعذّر النسخ تلقائيًا؛ يمكنك تحديد نص الأمر الظاهر أسفل البطاقة ونسخه يدويًا.";
    }
  }

  function renderItems() {
    const filtered = selectedItems();
    const visible = filtered.slice(0, visibleLimit);
    const categories = categoryMap();
    const fragment = document.createDocumentFragment();

    visible.forEach((item, index) => {
      const category = categories.get(item.categoryId);
      const command = commandsById.get(item.id);
      const card = makeElement("article", command ? "catalog-item-card catalog-item-card-command" : "catalog-item-card");
      const top = makeElement("div", "item-card-top");
      top.append(
        makeElement("span", "item-index", formatter.format(index + 1).padStart(3, "٠")),
        makeElement("span", "item-category", category?.title || "عنصر"),
      );
      const title = makeElement("h3", "", item.name);
      const bottom = makeElement("div", "item-card-bottom");
      if (command) {
        const label = makeElement("span", "item-card-label", "أمر تثبيت — للنسخ اليدوي");
        const button = makeElement("button", "command-copy-button", "انسخ الأمر");
        button.type = "button";
        button.setAttribute("aria-label", `نسخ أمر تثبيت ${item.name}`);
        const fallback = makeElement("pre", "item-command-fallback");
        fallback.hidden = true;
        fallback.dir = "ltr";
        fallback.textContent = command.command;
        button.addEventListener("click", () => copyCommand(command.command, button, item.name, fallback));
        bottom.append(label, button);
        card.append(top, title, bottom, fallback);
      } else {
        bottom.append(makeElement("span", "item-card-label", "مدرج في الملف"), makeElement("span", "item-card-arrow", "↙"));
        card.append(top, title, bottom);
      }
      fragment.append(card);
    });

    grid.replaceChildren(fragment);
    emptyState.hidden = filtered.length !== 0;
    grid.hidden = filtered.length === 0;
    loadMoreButton.hidden = visible.length >= filtered.length || filtered.length === 0;
    summary.textContent = `عرض ${formatter.format(visible.length)} من ${formatter.format(filtered.length)} عنصر`;
    updateActiveButtons();
  }

  function resetFilters() {
    activeSection = "all";
    visibleLimit = pageSize;
    searchInput.value = "";
    document.querySelector("#catalog-sort").value = "source";
    sortMode = "source";
    document.querySelector("#clear-search").hidden = true;
    renderItems();
    searchInput.focus();
  }

  categoryList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-section]");
    if (!button) return;
    activeSection = button.dataset.section;
    visibleLimit = pageSize;
    renderItems();
  });

  categoryAll.addEventListener("click", () => {
    activeSection = "all";
    visibleLimit = pageSize;
    renderItems();
  });

  searchInput.addEventListener("input", () => {
    visibleLimit = pageSize;
    document.querySelector("#clear-search").hidden = searchInput.value.length === 0;
    renderItems();
  });

  document.querySelector("#clear-search").addEventListener("click", () => {
    searchInput.value = "";
    document.querySelector("#clear-search").hidden = true;
    visibleLimit = pageSize;
    renderItems();
    searchInput.focus();
  });

  document.querySelector("#catalog-sort").addEventListener("change", (event) => {
    sortMode = event.target.value;
    visibleLimit = pageSize;
    renderItems();
  });

  loadMoreButton.addEventListener("click", () => {
    visibleLimit += pageSize;
    renderItems();
  });

  document.querySelector("#reset-catalog").addEventListener("click", resetFilters);

  Promise.all(["./catalog-data.json", "./commands-data.json", "./catalog-sections.json"].map(async (path) => {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }))
    .then(([catalogData, commandData, sectionData]) => {
      if (!Array.isArray(catalogData.categories) || !Array.isArray(catalogData.items)
        || !Array.isArray(commandData.commands) || !Array.isArray(sectionData)) {
        throw new Error("صيغة بيانات الكتالوج غير صالحة.");
      }
      catalog = catalogData;
      sections = sectionData;
      const categories = categoryMap();
      const itemsById = new Map(catalog.items.map((item) => [item.id, item]));
      const itemsByNameAndCategory = new Map();
      for (const item of catalog.items) {
        const key = `${item.categoryId}\u0000${item.name}`;
        if (!itemsByNameAndCategory.has(key)) itemsByNameAndCategory.set(key, []);
        itemsByNameAndCategory.get(key).push(item);
      }
      commandsById = new Map();
      for (const command of commandData.commands) {
        if (command.categoryId === "remove") continue;
        const byId = itemsById.get(command.id);
        let item = byId && byId.name === command.name && byId.categoryId === command.categoryId ? byId : null;
        if (!item) {
          const matches = itemsByNameAndCategory.get(`${command.categoryId}\u0000${command.name}`) || [];
          if (matches.length === 1) item = matches[0];
        }
        if (item && !commandsById.has(item.id)) commandsById.set(item.id, command);
      }

      const sectionRoots = new Set(sectionData.flatMap((section) => section.categoryIds));
      const roots = new Set(catalog.categories.filter((category) => category.parentId === null).map((category) => category.id));
      if (sectionRoots.size !== roots.size || [...roots].some((root) => !sectionRoots.has(root))) {
        throw new Error("مجموعات الأقسام لا تغطي التصنيفات.");
      }

      document.querySelector("#catalog-item-count").textContent = formatter.format(catalog.items.length);
      document.querySelector("#catalog-category-count").textContent = formatter.format(sectionData.length);
      document.querySelector("#catalog-command-count").textContent = formatter.format(commandsById.size);
      document.querySelector("#all-count").textContent = formatter.format(catalog.items.length);
      renderSections();
      renderItems();
      message.hidden = true;
    })
    .catch(() => {
      summary.textContent = "تعذّر تحميل بيانات الكتالوج.";
      message.textContent = "تعذّر تحميل الفهرس أو أوامر النسخ الآن. أعد تحميل الصفحة، أو ارجع إلى الصفحة الرئيسية.";
      message.hidden = false;
      categoryList.replaceChildren();
      grid.replaceChildren();
    });
}
