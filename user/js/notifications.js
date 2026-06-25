import { apiRequest } from "./api.js";
import { elements } from "./dom.js";
import {
  saveSeenNotifications,
  saveTrackedRequests,
} from "./storage.js";
import { state } from "./state.js";
import { escapeHtml, formatRequestId, statusClass } from "./ui.js";

export function renderNotifications() {
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
    .map(renderNotificationItem)
    .join("");
}

export function markNotificationsRead() {
  state.trackedRequests.filter(isAdminUpdate).forEach((request) => {
    state.seenNotifications[notificationKey(request)] = true;
  });
  saveSeenNotifications();
  renderNotifications();
}

export function closeNotifications() {
  state.notificationsOpen = false;
  if (elements.notificationPanel) elements.notificationPanel.hidden = true;
  if (elements.notificationButton) {
    elements.notificationButton.setAttribute("aria-expanded", "false");
  }
}

export function toggleNotifications() {
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

export async function loadTrackedRequestStatuses() {
  if (!state.trackedRequests.length) {
    renderNotifications();
    return;
  }

  state.trackedRequests = await Promise.all(
    state.trackedRequests.map(loadTrackedRequestStatus),
  );
  saveTrackedRequests();

  if (state.notificationsOpen) {
    markNotificationsRead();
  } else {
    renderNotifications();
  }
}

export function notificationStatus(request) {
  return request.status === "Picked Up" ||
    (request.status === "Approved" && request.picked_up_at)
    ? "Picked Up"
    : request.status;
}

function renderNotificationItem(request) {
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
}

async function loadTrackedRequestStatus(request) {
  try {
    const payload = await apiRequest(
      `/public/borrow-requests/${request.id}?token=${encodeURIComponent(request.token)}`,
    );
    return { ...request, ...payload.data, token: request.token };
  } catch {
    return request;
  }
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
