import { elements } from "./dom.js";
import { state } from "./state.js";
import { loadBorrowerProfile } from "./storage.js";

export function renderVisitorProfile() {
  const name = state.borrowerProfile?.borrower_name || "User";
  const location = [
    state.borrowerProfile?.department,
    state.borrowerProfile?.room_name,
  ].filter(Boolean).join(" - ");
  if (elements.visitorName) elements.visitorName.textContent = name;
  if (elements.visitorRole) elements.visitorRole.textContent = location || "Borrower";
  if (elements.visitorAvatar) {
    elements.visitorAvatar.textContent =
      name.trim().charAt(0).toUpperCase() || "U";
  }
}

export function applyBorrowerProfile(item) {
  const profile = state.borrowerProfile || loadBorrowerProfile();
  elements.borrowerName.value = profile.borrower_name || "";
  elements.borrowerReference.value = profile.borrower_reference || "";
  elements.department.value = profile.department || item.department || "";
  elements.contactNumber.value = profile.contact_number || "";
}
