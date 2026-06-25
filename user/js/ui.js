import { elements } from "./dom.js";

export function statusClass(status) {
  return String(status || "")
    .toLowerCase()
    .replace(/\s+/g, "-");
}

export function escapeHtml(value) {
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

export function showMessage(message, type = "success") {
  elements.messageBox.textContent = message;
  elements.messageBox.className = `alert ${type}`;
  elements.messageBox.hidden = false;
}

export function clearMessage() {
  elements.messageBox.hidden = true;
  elements.messageBox.textContent = "";
}

export function formatRequestId(id) {
  return `REQ-${String(id).padStart(6, "0")}`;
}
