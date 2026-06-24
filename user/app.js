const TRACKED_REQUESTS_KEY = "cpms_public_borrow_requests";
const SEEN_NOTIFICATIONS_KEY = "cpms_public_seen_notifications";
const BORROWER_PROFILE_KEY = "cpms_public_borrower_profile";
const AUTH_USER_KEY = "user";
const DEFAULT_BORROW_DURATION_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const state = {
  items: [],
  trackedRequests: [],
  seenNotifications: {},
  borrowerProfile: null,
  notificationsOpen: false,
  selectedItem: null,
  selectedCategory: "",
};

const elements = {
  refreshButton: document.querySelector("#refreshButton"),
  searchInput: document.querySelector("#searchInput"),
  statusFilter: document.querySelector("#statusFilter"),
  categoryStrip: document.querySelector("#categoryStrip"),
  messageBox: document.querySelector("#messageBox"),
  itemCount: document.querySelector("#itemCount"),
  totalItems: document.querySelector("#totalItems"),
  availableItems: document.querySelector("#availableItems"),
  borrowedItems: document.querySelector("#borrowedItems"),
  itemsGrid: document.querySelector("#itemsGrid"),
  notificationButton: document.querySelector("#notificationButton"),
  notificationBadge: document.querySelector("#notificationBadge"),
  notificationPanel: document.querySelector("#notificationPanel"),
  notificationCount: document.querySelector("#notificationCount"),
  notificationList: document.querySelector("#notificationList"),
  visitorAvatar: document.querySelector("#visitorAvatar"),
  visitorName: document.querySelector("#visitorName"),
  visitorRole: document.querySelector("#visitorRole"),
  requestModal: document.querySelector("#requestModal"),
  requestForm: document.querySelector("#requestForm"),
  closeModalButton: document.querySelector("#closeModalButton"),
  cancelButton: document.querySelector("#cancelButton"),
  submitButton: document.querySelector("#submitButton"),
  borrowerName: document.querySelector("#borrowerName"),
  borrowerReference: document.querySelector("#borrowerReference"),
  department: document.querySelector("#department"),
  contactNumber: document.querySelector("#contactNumber"),
  borrowDate: document.querySelector("#borrowDate"),
  borrowDuration: document.querySelector("#borrowDuration"),
  dueDate: document.querySelector("#dueDate"),
  purpose: document.querySelector("#purpose"),
  remarks: document.querySelector("#remarks"),
};

function localDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromInput(value) {
  const [year, month, day] = String(value || "")
    .split("-")
    .map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function dateInputValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDaysToInputDate(value, days) {
  const date = dateFromInput(value);
  if (!date) return "";
  date.setDate(date.getDate() + days);
  return dateInputValue(date);
}

function borrowDurationDays() {
  const parsed = Number(elements.borrowDuration.value);
  if (!Number.isFinite(parsed)) return DEFAULT_BORROW_DURATION_DAYS;
  return Math.min(365, Math.max(1, Math.round(parsed)));
}

function updateDueDateFromDuration() {
  const duration = borrowDurationDays();
  elements.borrowDuration.value = duration;
  const minimumDueDate = addDaysToInputDate(elements.borrowDate.value, 1);
  elements.dueDate.min = minimumDueDate;
  elements.dueDate.value = addDaysToInputDate(elements.borrowDate.value, duration);
}

function updateDurationFromDueDate() {
  const startDate = dateFromInput(elements.borrowDate.value);
  const dueDate = dateFromInput(elements.dueDate.value);
  if (!startDate || !dueDate) return;
  const minimumDueDate = addDaysToInputDate(elements.borrowDate.value, 1);
  elements.dueDate.min = minimumDueDate;
  if (elements.dueDate.value < minimumDueDate) {
    elements.dueDate.value = minimumDueDate;
  }
  const nextDueDate = dateFromInput(elements.dueDate.value);
  const difference = Math.round((nextDueDate - startDate) / MS_PER_DAY);
  elements.borrowDuration.value = Math.min(365, Math.max(1, difference));
}

function statusClass(status) {
  return String(status || "")
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[char],
  );
}

function showMessage(message, type = "success") {
  elements.messageBox.textContent = message;
  elements.messageBox.className = `alert ${type}`;
  elements.messageBox.hidden = false;
}

function clearMessage() {
  elements.messageBox.hidden = true;
  elements.messageBox.textContent = "";
}

function readJsonStorage(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") || fallback;
  } catch {
    return fallback;
  }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response
    .json()
    .catch(() => ({ success: false, message: "Invalid server response" }));
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || `Request failed (${response.status})`);
  }
  return payload;
}

function loadSavedRequests() {
  try {
    const saved = JSON.parse(localStorage.getItem(TRACKED_REQUESTS_KEY) || "[]");
    return saved
      .map((request) => ({
        ...request,
        id: Number(request.id),
        token: String(request.token || ""),
      }))
      .filter((request) => request.id > 0 && request.token.length === 64)
      .slice(0, 12);
  } catch {
    return [];
  }
}

function loadBorrowerProfile() {
  const savedProfile = readJsonStorage(BORROWER_PROFILE_KEY, {});
  const authUser = readJsonStorage(AUTH_USER_KEY, {});
  return {
    borrower_name: String(
      authUser?.name || savedProfile.borrower_name || "",
    ).trim(),
    borrower_reference: String(
      savedProfile.borrower_reference || authUser?.email || "",
    ).trim(),
    department: String(savedProfile.department || authUser?.department || "").trim(),
    contact_number: String(savedProfile.contact_number || "").trim(),
  };
}

function renderVisitorProfile() {
  const name = state.borrowerProfile?.borrower_name || "User";
  if (elements.visitorName) elements.visitorName.textContent = name;
  if (elements.visitorRole) elements.visitorRole.textContent = "Borrower";
  if (elements.visitorAvatar) {
    elements.visitorAvatar.textContent =
      name.trim().charAt(0).toUpperCase() || "U";
  }
}

function saveBorrowerProfileFromForm() {
  const profile = {
    borrower_name: elements.borrowerName.value.trim(),
    borrower_reference: elements.borrowerReference.value.trim(),
    department: elements.department.value.trim(),
    contact_number: elements.contactNumber.value.trim(),
  };
  if (!profile.borrower_name) return;
  state.borrowerProfile = profile;
  localStorage.setItem(BORROWER_PROFILE_KEY, JSON.stringify(profile));
  renderVisitorProfile();
}

function applyBorrowerProfile(item) {
  const profile = state.borrowerProfile || loadBorrowerProfile();
  elements.borrowerName.value = profile.borrower_name || "";
  elements.borrowerReference.value = profile.borrower_reference || "";
  elements.department.value = profile.department || item.department || "";
  elements.contactNumber.value = profile.contact_number || "";
}

function loadSeenNotifications() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(SEEN_NOTIFICATIONS_KEY) || "{}",
    );
    return saved && typeof saved === "object" && !Array.isArray(saved)
      ? saved
      : {};
  } catch {
    return {};
  }
}

function saveSeenNotifications() {
  localStorage.setItem(
    SEEN_NOTIFICATIONS_KEY,
    JSON.stringify(state.seenNotifications),
  );
}

function saveTrackedRequests() {
  const saved = state.trackedRequests.map((request) => ({
    id: request.id,
    token: request.token,
    status: request.status,
    ticket_number: request.ticket_number,
    review_notes: request.review_notes,
    reviewed_at: request.reviewed_at,
    picked_up_at: request.picked_up_at,
    item_code: request.item_code,
    item_name: request.item_name,
    borrower_name: request.borrower_name,
    due_date: request.due_date,
    created_at: request.created_at,
  }));
  localStorage.setItem(TRACKED_REQUESTS_KEY, JSON.stringify(saved.slice(0, 12)));
}

function rememberRequest(request) {
  const nextRequest = {
    id: Number(request.id),
    token: String(request.token || ""),
    status: "Pending",
    item_code: state.selectedItem?.item_code || "",
    item_name: state.selectedItem?.item_name || "",
    borrower_name: elements.borrowerName.value.trim(),
    due_date: elements.dueDate.value,
    created_at: new Date().toISOString(),
  };
  if (!nextRequest.id || nextRequest.token.length !== 64) return;
  state.trackedRequests = [
    nextRequest,
    ...state.trackedRequests.filter((entry) => entry.id !== nextRequest.id),
  ].slice(0, 12);
  saveTrackedRequests();
}

function isAdminUpdate(request) {
  return ["Approved", "Picked Up", "Rejected", "Cancelled"].includes(
    notificationStatus(request),
  );
}

function notificationKey(request) {
  return [
    request.id,
    request.status || "Pending",
    request.ticket_number || "",
    request.reviewed_at || "",
    request.picked_up_at || "",
  ].join(":");
}

function ticketNumberFor(request) {
  return ["Approved", "Picked Up"].includes(notificationStatus(request)) &&
    request.ticket_number
    ? request.ticket_number
    : formatRequestId(request.id);
}

function notificationStatus(request) {
  return request.status === "Picked Up" ||
    (request.status === "Approved" && request.picked_up_at)
    ? "Picked Up"
    : request.status;
}

function renderNotifications() {
  if (!elements.notificationList) return;

  const adminUpdates = state.trackedRequests.filter(isAdminUpdate);
  const unreadUpdates = adminUpdates.filter(
    (request) => !state.seenNotifications[notificationKey(request)],
  );

  if (elements.notificationBadge) {
    elements.notificationBadge.textContent = unreadUpdates.length;
    elements.notificationBadge.hidden = unreadUpdates.length === 0;
  }
  if (elements.notificationCount) {
    elements.notificationCount.textContent = `${unreadUpdates.length} new`;
  }

  if (!adminUpdates.length) {
    elements.notificationList.innerHTML = "<p>No admin updates yet.</p>";
    return;
  }

  elements.notificationList.innerHTML = adminUpdates
    .map((request) => {
      const unread = !state.seenNotifications[notificationKey(request)];
      const status = notificationStatus(request);
      return `
        <article class="notification-item ${unread ? "is-unread" : ""}">
          <div>
            <span class="status-badge status-${statusClass(status)}">${escapeHtml(status)}</span>
            <h3>${escapeHtml(request.item_name || "Requested item")}</h3>
            <p>${escapeHtml(requestStatusMessage(request))}</p>
          </div>
          <strong>${escapeHtml(ticketNumberFor(request))}</strong>
        </article>
      `;
    })
    .join("");
}

function markNotificationsRead() {
  state.trackedRequests.filter(isAdminUpdate).forEach((request) => {
    state.seenNotifications[notificationKey(request)] = true;
  });
  saveSeenNotifications();
  renderNotifications();
}

function closeNotifications() {
  state.notificationsOpen = false;
  if (elements.notificationPanel) elements.notificationPanel.hidden = true;
  if (elements.notificationButton) {
    elements.notificationButton.setAttribute("aria-expanded", "false");
  }
}

function toggleNotifications() {
  state.notificationsOpen = !state.notificationsOpen;
  if (elements.notificationPanel) {
    elements.notificationPanel.hidden = !state.notificationsOpen;
  }
  if (elements.notificationButton) {
    elements.notificationButton.setAttribute(
      "aria-expanded",
      String(state.notificationsOpen),
    );
  }
  if (state.notificationsOpen) markNotificationsRead();
}

function formatRequestId(id) {
  return `REQ-${String(id).padStart(6, "0")}`;
}

function requestStatusMessage(request) {
  if (notificationStatus(request) === "Picked Up") {
    return "Item pickup confirmed. Keep this ticket for return.";
  }
  if (request.status === "Approved") {
    return "Approved. Go to the Supply Office and bring this ticket.";
  }
  if (request.status === "Rejected") {
    return request.review_notes || "Request rejected. Please contact the Supply Office for details.";
  }
  if (request.status === "Cancelled") {
    return "This request was cancelled.";
  }
  return "Waiting for admin approval.";
}

async function loadTrackedRequestStatuses() {
  if (!state.trackedRequests.length) {
    renderNotifications();
    return;
  }

  const updatedRequests = await Promise.all(
    state.trackedRequests.map(async (request) => {
      try {
        const payload = await apiRequest(
          `/public/borrow-requests/${request.id}?token=${encodeURIComponent(request.token)}`,
        );
        return { ...request, ...payload.data, token: request.token };
      } catch {
        return request;
      }
    }),
  );
  state.trackedRequests = updatedRequests;
  saveTrackedRequests();
  if (state.notificationsOpen) {
    markNotificationsRead();
  } else {
    renderNotifications();
  }
}

function filteredItems() {
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

function renderCategories() {
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

function renderItems() {
  const items = filteredItems();
  const availableCount = state.items.filter(
    (item) => item.available_for_borrow,
  ).length;
  const borrowedCount = state.items.filter(
    (item) => item.status === "Borrowed",
  ).length;

  elements.totalItems.textContent = state.items.length;
  elements.availableItems.textContent = availableCount;
  elements.borrowedItems.textContent = borrowedCount;
  elements.itemCount.textContent = `${items.length} ${items.length === 1 ? "item" : "items"} shown`;

  if (!items.length) {
    elements.itemsGrid.innerHTML =
      '<p class="empty-state">No inventory items found</p>';
    return;
  }

  elements.itemsGrid.innerHTML = items
    .map((item) => {
      const location =
        item.room_number || item.building || item.department || "N/A";
      const availability = item.available_for_borrow
        ? "Ready to request"
        : "Currently unavailable";
      const action = item.available_for_borrow
        ? `<button class="btn btn-primary borrow-button" type="button" data-item-id="${item.id}">Request Item</button>`
        : '<button class="btn btn-secondary" type="button" disabled>Unavailable</button>';
      const image = item.image_url
        ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.item_name)}" loading="lazy">`
        : `<div class="item-image-placeholder" data-letter="${escapeHtml((item.item_name || "?").trim().charAt(0).toUpperCase() || "?")}"></div>`;
      return `
      <article class="item-card">
        <div class="item-photo">
          ${image}
          <span class="status-badge status-${statusClass(item.status)}">${escapeHtml(item.status)}</span>
        </div>
        <div class="item-card-body">
          <div class="item-card-title">
            <div class="item-card-kicker">
              <span>${escapeHtml(item.category || "General")}</span>
            </div>
            <h3>${escapeHtml(item.item_name)}</h3>
            <p class="item-code">${escapeHtml(item.item_code)}</p>
          </div>
          <p class="availability-note ${item.available_for_borrow ? "is-ready" : "is-paused"}">${availability}</p>
          <dl class="item-meta">
            <div><dt>Condition</dt><dd>${escapeHtml(item.condition || "N/A")}</dd></div>
            <div><dt>Location</dt><dd>${escapeHtml(location)}</dd></div>
            <div class="meta-wide"><dt>Serial Number</dt><dd>${escapeHtml(item.serial_number || "None")}</dd></div>
          </dl>
          ${action}
        </div>
      </article>
    `;
    })
    .join("");
}

async function loadItems() {
  clearMessage();
  elements.itemsGrid.innerHTML =
    '<p class="empty-state">Loading inventory...</p>';
  try {
    const payload = await apiRequest("/public/items");
    state.items = payload.data;
    if (
      state.selectedCategory &&
      !state.items.some((item) => item.category === state.selectedCategory)
    ) {
      state.selectedCategory = "";
    }
    renderCategories();
    renderItems();
  } catch (error) {
    state.items = [];
    renderCategories();
    renderItems();
    showMessage(error.message, "error");
  }
}

function openRequestForm(item) {
  state.selectedItem = item;
  elements.requestForm.reset();
  applyBorrowerProfile(item);
  elements.borrowDate.value = localDate();
  elements.borrowDuration.value = DEFAULT_BORROW_DURATION_DAYS;
  updateDueDateFromDuration();
  elements.requestModal.hidden = false;
  if (elements.borrowerName.value.trim()) {
    elements.borrowDuration.focus();
  } else {
    elements.borrowerName.focus();
  }
}

function closeRequestForm() {
  elements.requestModal.hidden = true;
  state.selectedItem = null;
}

async function submitBorrowRequest(event) {
  event.preventDefault();
  if (!state.selectedItem) return;

  elements.submitButton.disabled = true;
  elements.submitButton.textContent = "Submitting...";
  clearMessage();

  const body = {
    item_id: state.selectedItem.id,
    borrower_name: elements.borrowerName.value.trim(),
    borrower_reference: elements.borrowerReference.value.trim(),
    department: elements.department.value.trim(),
    contact_number: elements.contactNumber.value.trim(),
    requested_borrow_date: elements.borrowDate.value,
    due_date: elements.dueDate.value,
    condition_out: state.selectedItem.condition || "Good",
    purpose: elements.purpose.value.trim(),
    remarks: elements.remarks.value.trim(),
  };

  try {
    const payload = await apiRequest("/public/borrow-requests", {
      method: "POST",
      body,
    });
    saveBorrowerProfileFromForm();
    rememberRequest(payload.data);
    closeRequestForm();
    showMessage(
      `Borrow request submitted. Your request number is ${formatRequestId(payload.data.id)}. Please wait for admin approval.`,
    );
    await loadTrackedRequestStatuses();
    await loadItems();
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    elements.submitButton.disabled = false;
    elements.submitButton.textContent = "Submit Request";
  }
}

if (elements.refreshButton) {
  elements.refreshButton.addEventListener("click", loadItems);
}
if (elements.notificationButton) {
  elements.notificationButton.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleNotifications();
  });
}
elements.searchInput.addEventListener("input", renderItems);
elements.statusFilter.addEventListener("change", renderItems);
elements.categoryStrip.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.selectedCategory = button.dataset.category;
  renderCategories();
  renderItems();
});
elements.closeModalButton.addEventListener("click", closeRequestForm);
elements.cancelButton.addEventListener("click", closeRequestForm);
elements.requestForm.addEventListener("submit", submitBorrowRequest);
elements.borrowDate.addEventListener("change", () => {
  updateDueDateFromDuration();
});
elements.borrowDuration.addEventListener("input", updateDueDateFromDuration);
elements.dueDate.addEventListener("change", updateDurationFromDueDate);
elements.itemsGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".borrow-button");
  if (!button) return;
  const item = state.items.find(
    (record) => Number(record.id) === Number(button.dataset.itemId),
  );
  if (item) openRequestForm(item);
});
elements.requestModal.addEventListener("mousedown", (event) => {
  if (event.target === elements.requestModal) closeRequestForm();
});
document.addEventListener("click", (event) => {
  if (!state.notificationsOpen) return;
  if (event.target.closest(".notification-wrap")) return;
  closeNotifications();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeNotifications();
});

state.seenNotifications = loadSeenNotifications();
state.borrowerProfile = loadBorrowerProfile();
state.trackedRequests = loadSavedRequests();
renderVisitorProfile();
renderNotifications();
loadItems();
loadTrackedRequestStatuses();
setInterval(loadTrackedRequestStatuses, 20000);
