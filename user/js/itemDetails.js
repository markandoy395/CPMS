import { elements } from "./dom.js";
import { openRequestForm } from "./requestForm.js";
import { state } from "./state.js";
import { escapeHtml, statusClass } from "./ui.js";

export function openItemDetails(item) {
  state.selectedDetailItem = item;
  elements.itemDetailTitle.textContent = item.item_name || "Item Details";
  elements.itemDetailAvailability.textContent = item.available_for_borrow
    ? "Ready to request"
    : "Currently unavailable";
  elements.itemDetailStatus.textContent = item.status || "N/A";
  elements.itemDetailStatus.className = `status-badge status-${statusClass(item.status)}`;
  elements.itemDetailDescription.textContent =
    item.description || "No description has been added for this item.";
  elements.itemDetailImage.innerHTML = detailImageMarkup(item);
  elements.itemDetailSpecs.innerHTML = detailSpecs(item)
    .map(
      ([label, value]) =>
        `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "N/A")}</dd></div>`,
    )
    .join("");
  elements.detailRequestButton.hidden = !item.available_for_borrow;
  elements.itemDetailModal.hidden = false;
  elements.closeDetailButton.focus();
}

export function closeItemDetails() {
  elements.itemDetailModal.hidden = true;
  state.selectedDetailItem = null;
}

export function requestSelectedDetailItem() {
  if (!state.selectedDetailItem?.available_for_borrow) return;
  const item = state.selectedDetailItem;
  closeItemDetails();
  openRequestForm(item);
}

function detailSpecs(item) {
  const sourceOffice = "Supply Office";

  return [
    ["Serial Number", item.serial_number || "None"],
    ["Category", item.category],
    ["Subcategory", item.subcategory],
    ["Brand", item.brand],
    ["Model", item.model_number],
    ["Condition", item.condition],
    ["Asset Type", item.asset_type],
    ["Quantity", item.quantity],
    ["Source Office", sourceOffice],
    ["Release Location", sourceOffice],
  ];
}

function detailImageMarkup(item) {
  const letter = (item.item_name || "?").trim().charAt(0).toUpperCase() || "?";
  return `<div class="detail-placeholder">${escapeHtml(letter)}</div>`;
}
