import { elements } from "./dom.js";
import {
  closeItemDetails,
  openItemDetails,
  requestSelectedDetailItem,
} from "./itemDetails.js";
import { logoutPublicUser } from "./userLogin.js";
import { renderCategories, renderItems, loadItems } from "./items.js";
import { closeNotifications, toggleNotifications } from "./notifications.js";
import {
  closeRequestForm,
  openRequestForm,
  submitBorrowRequest,
  updateDueDateFromDuration,
  updateDurationFromDueDate,
} from "./requestForm.js";
import { state } from "./state.js";

export function attachEventHandlers() {
  elements.refreshButton?.addEventListener("click", loadItems);
  elements.notificationButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleNotifications();
  });
  elements.logoutButton?.addEventListener("click", logoutPublicUser);

  elements.searchInput.addEventListener("input", renderItems);
  elements.statusFilter.addEventListener("change", renderItems);
  elements.categoryStrip.addEventListener("click", handleCategoryClick);
  elements.closeModalButton.addEventListener("click", closeRequestForm);
  elements.cancelButton.addEventListener("click", closeRequestForm);
  elements.closeDetailButton.addEventListener("click", closeItemDetails);
  elements.detailRequestButton.addEventListener("click", requestSelectedDetailItem);
  elements.requestForm.addEventListener("submit", submitBorrowRequest);
  elements.borrowDate.addEventListener("change", updateDueDateFromDuration);
  elements.borrowDuration.addEventListener("input", updateDueDateFromDuration);
  elements.dueDate.addEventListener("change", updateDurationFromDueDate);
  elements.itemsGrid.addEventListener("click", handleItemClick);
  elements.itemsGrid.addEventListener("keydown", handleItemKeydown);
  elements.requestModal.addEventListener("mousedown", handleModalMouseDown);
  elements.itemDetailModal.addEventListener("mousedown", handleDetailModalMouseDown);
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleDocumentKeydown);
}

function handleCategoryClick(event) {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.selectedCategory = button.dataset.category;
  renderCategories();
  renderItems();
}

function handleItemClick(event) {
  const button = event.target.closest(".borrow-button");
  if (button) {
    event.stopPropagation();
    openItemFromDataset(button.dataset.itemId, openRequestForm);
    return;
  }

  const card = event.target.closest(".item-card[data-item-id]");
  if (card) openItemFromDataset(card.dataset.itemId, openItemDetails);
}

function handleItemKeydown(event) {
  if (!["Enter", " "].includes(event.key)) return;
  const card = event.target.closest(".item-card[data-item-id]");
  if (!card || event.target.closest("button")) return;
  event.preventDefault();
  openItemFromDataset(card.dataset.itemId, openItemDetails);
}

function openItemFromDataset(itemId, callback) {
  const item = state.items.find((record) => Number(record.id) === Number(itemId));
  if (item) callback(item);
}

function handleModalMouseDown(event) {
  if (event.target === elements.requestModal) closeRequestForm();
}

function handleDetailModalMouseDown(event) {
  if (event.target === elements.itemDetailModal) closeItemDetails();
}

function handleDocumentClick(event) {
  if (!state.notificationsOpen) return;
  if (event.target.closest(".notification-wrap")) return;
  closeNotifications();
}

function handleDocumentKeydown(event) {
  if (event.key !== "Escape") return;
  closeNotifications();
  closeItemDetails();
}
