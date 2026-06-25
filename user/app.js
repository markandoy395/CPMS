import { attachEventHandlers } from "./js/events.js";
import {
  loadBorrowerProfile,
  loadSavedRequests,
  loadSeenNotifications,
} from "./js/storage.js";
import { loadItems } from "./js/items.js";
import { loadTrackedRequestStatuses, renderNotifications } from "./js/notifications.js";
import { renderVisitorProfile } from "./js/profile.js";
import { setupScreenAccessGuard } from "./js/screenAccess.js";
import { state } from "./js/state.js";
import { ensureUserLogin } from "./js/userLogin.js";

let gatewayStarted = false;
let statusTimerId;

function bootUserGateway() {
  if (!gatewayStarted) {
    state.seenNotifications = loadSeenNotifications();
    state.borrowerProfile = loadBorrowerProfile();
    state.trackedRequests = loadSavedRequests();

    attachEventHandlers();
    gatewayStarted = true;
  }

  renderVisitorProfile();
  ensureUserLogin();
  renderNotifications();
  loadItems();
  loadTrackedRequestStatuses();
  startStatusPolling();
}

function startStatusPolling() {
  if (!statusTimerId) statusTimerId = setInterval(loadTrackedRequestStatuses, 20000);
}

function stopStatusPolling() {
  if (!statusTimerId) return;
  clearInterval(statusTimerId);
  statusTimerId = null;
}

setupScreenAccessGuard({
  onAllowed: bootUserGateway,
  onBlocked: stopStatusPolling,
});
