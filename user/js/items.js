import { apiRequest } from "./api.js";
import { elements } from "./dom.js";
import { state } from "./state.js";
import { clearMessage, escapeHtml, showMessage, statusClass } from "./ui.js";

export function filteredItems() {
  const search = elements.searchInput.value.trim().toLowerCase();
  const status = elements.statusFilter.value;
  const category = state.selectedCategory;

  return state.items.filter((item) => {
    const searchable =
      `${item.item_name} ${item.item_code} ${item.serial_number || ""} ${item.category || ""}`.toLowerCase();
    return (
      searchable.includes(search) &&
      (!status || item.status === status) &&
      (!category || item.category === category)
    );
  });
}

export function renderCategories() {
  const categories = Array.from(
    new Set(state.items.map((item) => item.category).filter(Boolean)),
  ).sort((first, second) => first.localeCompare(second));

  elements.categoryStrip.innerHTML = [
    `<button class="category-chip ${state.selectedCategory ? "" : "active"}" type="button" data-category="">All Items</button>`,
    ...categories.map(
      (category) =>
        `<button class="category-chip ${state.selectedCategory === category ? "active" : ""}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`,
    ),
  ].join("");
}

export function renderItems() {
  const items = filteredItems();
  const availableCount = state.items.filter((item) => item.available_for_borrow).length;
  const borrowedCount = state.items.filter((item) => item.status === "Borrowed").length;

  elements.totalItems.textContent = state.items.length;
  elements.availableItems.textContent = availableCount;
  elements.borrowedItems.textContent = borrowedCount;
  elements.itemCount.textContent = `${items.length} ${items.length === 1 ? "item" : "items"} shown`;

  if (!items.length) {
    elements.itemsGrid.innerHTML = '<p class="empty-state">No inventory items found</p>';
    return;
  }

  elements.itemsGrid.innerHTML = items.map(renderItemCard).join("");
}

export async function loadItems() {
  clearMessage();
  elements.itemsGrid.innerHTML = '<p class="empty-state">Loading inventory...</p>';

  try {
    const payload = await apiRequest("/public/items");
    state.items = payload.data;
    if (
      state.selectedCategory &&
      !state.items.some((item) => item.category === state.selectedCategory)
    ) {
      state.selectedCategory = "";
    }
  } catch (error) {
    state.items = [];
    showMessage(error.message, "error");
  }

  renderCategories();
  renderItems();
}

function renderItemCard(item) {
  const sourceOffice = "Supply Office";
  const availability = item.available_for_borrow
    ? "Ready to request"
    : "Currently unavailable";
  const action = item.available_for_borrow
    ? `<button class="btn btn-primary borrow-button" type="button" data-item-id="${item.id}">Request Item</button>`
    : '<button class="btn btn-secondary" type="button" disabled>Unavailable</button>';
  const letter = escapeHtml(
    (item.item_name || "?").trim().charAt(0).toUpperCase() || "?",
  );

  return `
    <article class="item-card card-${statusClass(item.status)}" role="button" tabindex="0" data-item-id="${item.id}" aria-label="View ${escapeHtml(item.item_name)} details">
      <div class="item-photo">
        <div class="item-image-placeholder" data-letter="${letter}"></div>
        <span class="status-badge status-${statusClass(item.status)}">${escapeHtml(item.status)}</span>
      </div>
      <div class="item-card-body">
        <div class="item-card-title">
          <div class="item-card-kicker"><span>${escapeHtml(item.category || "General")}</span></div>
          <h3>${escapeHtml(item.item_name)}</h3>
          <p class="item-code">${escapeHtml(item.category || "General")}</p>
        </div>
        <p class="availability-note ${item.available_for_borrow ? "is-ready" : "is-paused"}">${availability}</p>
        <dl class="item-meta">
          <div><dt>Condition</dt><dd>${escapeHtml(item.condition || "N/A")}</dd></div>
          <div><dt>Location</dt><dd>${escapeHtml(sourceOffice)}</dd></div>
          <div class="meta-wide"><dt>Serial Number</dt><dd>${escapeHtml(item.serial_number || "None")}</dd></div>
        </dl>
        ${action}
      </div>
    </article>
  `;
}
