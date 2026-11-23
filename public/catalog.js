const searchInput = document.querySelector("#catalog-search");
const categoryList = document.querySelector("#catalog-categories");
const categoryAll = document.querySelector("#category-all");
const grid = document.querySelector("#catalog-grid");
const summary = document.querySelector("#result-summary");
const loadMoreButton = document.querySelector("#load-more");
const emptyState = document.querySelector("#empty-state");
const message = document.querySelector("#catalog-message");

if (searchInput && categoryList && grid) {
  const formatter = new Intl.NumberFormat("ar-EG");
  const pageSize = 36;
  let catalog = { categories: [], items: [] };
  let activeCategory = "all";
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

  function renderCategoryTree() {
    const roots = catalog.categories.filter((category) => category.parentId === null);
    const children = new Map();
    for (const category of catalog.categories) {
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

  function selectedItems() {
    const query = normalize(searchInput.value);
    const categories = categoryMap();
    let filtered = catalog.items.filter((item) => {
      const category = categories.get(item.categoryId);
      const parent = categories.get(item.parentCategoryId);
      const inCategory = activeCategory === "all"
        || item.categoryId === activeCategory
        || item.parentCategoryId === activeCategory;
      const searchable = normalize(`${item.name} ${category?.title || ""} ${parent?.title || ""}`);
      return inCategory && (!query || searchable.includes(query));
    });

    if (sortMode === "asc") filtered = filtered.slice().sort((a, b) => a.name.localeCompare(b.name, "ar"));
    if (sortMode === "desc") filtered = filtered.slice().sort((a, b) => b.name.localeCompare(a.name, "ar"));
    return filtered;
  }

  function updateActiveButtons() {
    categoryAll.setAttribute("aria-pressed", String(activeCategory === "all"));
    categoryList.querySelectorAll("button[data-category]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.category === activeCategory));
    });
  }

  function renderItems() {
    const filtered = selectedItems();
    const visible = filtered.slice(0, visibleLimit);
    const categories = categoryMap();
    const fragment = document.createDocumentFragment();

    visible.forEach((item, index) => {
      const category = categories.get(item.categoryId);
      const card = makeElement("article", "catalog-item-card");
      const top = makeElement("div", "item-card-top");
      top.append(
        makeElement("span", "item-index", formatter.format(index + 1).padStart(3, "٠")),
        makeElement("span", "item-category", category?.title || "عنصر"),
      );
      const title = makeElement("h3", "", item.name);
      const bottom = makeElement("div", "item-card-bottom");
      bottom.append(makeElement("span", "item-card-label", "مدرج في الملف"), makeElement("span", "item-card-arrow", "↙"));
      card.append(top, title, bottom);
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
    activeCategory = "all";
    visibleLimit = pageSize;
    searchInput.value = "";
    document.querySelector("#catalog-sort").value = "source";
    sortMode = "source";
    document.querySelector("#clear-search").hidden = true;
    renderItems();
    searchInput.focus();
  }

  categoryList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-category]");
    if (!button) return;
    activeCategory = button.dataset.category;
    visibleLimit = pageSize;
    renderItems();
  });

  categoryAll.addEventListener("click", () => {
    activeCategory = "all";
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

  fetch("./catalog-data.json")
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((data) => {
      if (!Array.isArray(data.categories) || !Array.isArray(data.items)) throw new Error("صيغة بيانات الكتالوج غير صالحة.");
      catalog = data;
      document.querySelector("#catalog-item-count").textContent = formatter.format(data.items.length);
      document.querySelector("#catalog-category-count").textContent = formatter.format(data.categories.length);
      document.querySelector("#all-count").textContent = formatter.format(data.items.length);
      renderCategoryTree();
      renderItems();
      message.hidden = true;
    })
    .catch(() => {
      summary.textContent = "تعذر تحميل بيانات الكتالوج.";
      message.textContent = "تعذر تحميل الفهرس الآن. أعد تحميل الصفحة، أو ارجع إلى الصفحة الرئيسية.";
      message.hidden = false;
      categoryList.replaceChildren();
      grid.replaceChildren();
    });
}
