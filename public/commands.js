const searchInput = document.querySelector("#command-search");
const categoryList = document.querySelector("#command-categories");
const categoryAll = document.querySelector("#command-category-all");
const grid = document.querySelector("#command-grid");
const summary = document.querySelector("#command-result-summary");
const loadMoreButton = document.querySelector("#command-load-more");
const emptyState = document.querySelector("#command-empty");
const errorState = document.querySelector("#command-error");
const copyStatus = document.querySelector("#command-copy-status");

if (searchInput && categoryList && grid) {
  const formatter = new Intl.NumberFormat("ar-EG");
  const pageSize = 24;
  let data = { categories: [], commands: [] };
  let activeCategory = "all";
  let visibleLimit = pageSize;

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

  const categoryMap = () => new Map(data.categories.map((category) => [category.id, category]));

  function createCategoryButton(category, child = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = child ? "category-button category-button-child" : "category-button";
    button.dataset.category = category.id;
    button.setAttribute("aria-pressed", "false");
    const name = makeElement("span", "category-name");
    if (!child) name.append(makeElement("span", "category-symbol", category.title.slice(0, 1)));
    name.append(document.createTextNode(category.title));
    button.append(name, makeElement("span", "category-count", formatter.format(category.count)));
    return button;
  }

  function renderCategories() {
    const roots = data.categories.filter((category) => category.parentId === null);
    const children = new Map();
    for (const category of data.categories) {
      if (!category.parentId) continue;
      if (!children.has(category.parentId)) children.set(category.parentId, []);
      children.get(category.parentId).push(category);
    }
    const fragment = document.createDocumentFragment();
    for (const root of roots) {
      const group = makeElement("div", "category-group");
      group.append(createCategoryButton(root));
      const subcategories = children.get(root.id) || [];
      if (subcategories.length) {
        const childList = makeElement("div", "category-children");
        childList.setAttribute("aria-label", `تصنيفات ${root.title}`);
        for (const child of subcategories) childList.append(createCategoryButton(child, true));
        group.append(childList);
      }
      fragment.append(group);
    }
    categoryList.replaceChildren(fragment);
  }

  function matchingCommands() {
    const query = normalize(searchInput.value);
    const categories = categoryMap();
    return data.commands.filter((entry) => {
      const category = categories.get(entry.categoryId);
      const parent = category?.parentId ? categories.get(category.parentId) : category;
      const inCategory = activeCategory === "all"
        || entry.categoryId === activeCategory
        || category?.parentId === activeCategory;
      const searchable = normalize(`${entry.name} ${category?.title || ""} ${parent?.title || ""} ${entry.command}`);
      return inCategory && (!query || searchable.includes(query));
    });
  }

  function updateActiveButtons() {
    categoryAll.setAttribute("aria-pressed", String(activeCategory === "all"));
    categoryList.querySelectorAll("button[data-category]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.category === activeCategory));
    });
  }

  async function copyCommand(command, button, name) {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
      copyStatus.textContent = "تعذّر الوصول إلى الحافظة؛ حدّد نص الأمر لنسخه يدويًا.";
      return;
    }
    try {
      await navigator.clipboard.writeText(command);
      const originalLabel = button.dataset.originalLabel;
      button.textContent = "تم النسخ";
      copyStatus.textContent = `نُسخ أمر ${name} إلى الحافظة فقط؛ لم يتم تشغيله.`;
      window.setTimeout(() => {
        if (button.isConnected) button.textContent = originalLabel;
      }, 1800);
    } catch {
      copyStatus.textContent = "تعذّر النسخ تلقائيًا؛ حدّد نص الأمر لنسخه يدويًا.";
    }
  }

  function renderCommands() {
    const filtered = matchingCommands();
    const visible = filtered.slice(0, visibleLimit);
    const categories = categoryMap();
    const fragment = document.createDocumentFragment();

    visible.forEach((entry, index) => {
      const category = categories.get(entry.categoryId);
      const card = makeElement("article", "command-card");
      const top = makeElement("div", "command-card-top");
      const heading = makeElement("div", "command-card-heading");
      heading.append(
        makeElement("h3", "command-card-title", entry.name),
        makeElement("span", "command-card-category", category?.title || "تثبيت"),
      );
      top.append(heading, makeElement("span", "command-card-index", formatter.format(index + 1).padStart(3, "٠")));

      const codeWrap = makeElement("div", "command-code-wrap");
      const pre = makeElement("pre", "command-code");
      pre.tabIndex = 0;
      const code = makeElement("code", "", entry.command);
      pre.append(code);
      codeWrap.append(pre);

      const footer = makeElement("div", "command-card-footer");
      const source = makeElement("span", "command-source-label", "نص للنسخ — راجع المصدر أولًا");
      const button = makeElement("button", "command-copy-button", "نسخ الأمر");
      button.type = "button";
      button.dataset.originalLabel = "نسخ الأمر";
      button.setAttribute("aria-label", `نسخ أمر تثبيت ${entry.name}`);
      button.addEventListener("click", () => copyCommand(entry.command, button, entry.name));
      footer.append(source, button);
      card.append(top, codeWrap, footer);
      fragment.append(card);
    });

    grid.replaceChildren(fragment);
    emptyState.hidden = filtered.length !== 0;
    grid.hidden = filtered.length === 0;
    loadMoreButton.hidden = visible.length >= filtered.length || filtered.length === 0;
    summary.textContent = `عرض ${formatter.format(visible.length)} من ${formatter.format(filtered.length)} أمر`;
    updateActiveButtons();
  }

  categoryList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-category]");
    if (!button) return;
    activeCategory = button.dataset.category;
    visibleLimit = pageSize;
    renderCommands();
  });

  categoryAll.addEventListener("click", () => {
    activeCategory = "all";
    visibleLimit = pageSize;
    renderCommands();
  });

  searchInput.addEventListener("input", () => {
    visibleLimit = pageSize;
    document.querySelector("#clear-command-search").hidden = searchInput.value.length === 0;
    renderCommands();
  });

  document.querySelector("#clear-command-search").addEventListener("click", () => {
    searchInput.value = "";
    document.querySelector("#clear-command-search").hidden = true;
    renderCommands();
    searchInput.focus();
  });

  loadMoreButton.addEventListener("click", () => {
    visibleLimit += pageSize;
    renderCommands();
  });

  fetch("./commands-data.json")
    .then((response) => {
      if (!response.ok) throw new Error("Command data unavailable");
      return response.json();
    })
    .then((payload) => {
      if (!Array.isArray(payload.categories) || !Array.isArray(payload.commands)) throw new Error("Invalid command data");
      data = payload;
      document.querySelector("#command-count").textContent = formatter.format(data.totals.commands);
      document.querySelector("#command-category-count").textContent = formatter.format(data.totals.categories);
      document.querySelector("#all-command-count").textContent = formatter.format(data.totals.commands);
      renderCategories();
      renderCommands();
    })
    .catch(() => {
      summary.textContent = "تعذّر تحميل أوامر التثبيت.";
      grid.hidden = true;
      errorState.hidden = false;
    });
}
