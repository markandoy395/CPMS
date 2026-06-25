import {
  AUTH_USER_KEY,
  BORROWER_PROFILE_KEY,
  PUBLIC_AUTH_TOKEN_KEY,
  SEEN_NOTIFICATIONS_KEY,
  TRACKED_REQUESTS_KEY,
} from "./constants.js";
import { elements } from "./dom.js";
import { state } from "./state.js";

export function readJsonStorage(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") || fallback;
  } catch {
    return fallback;
  }
}

export function loadSavedRequests() {
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

export function loadBorrowerProfile() {
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
    room_name: String(savedProfile.room_name || "").trim(),
    contact_number: String(savedProfile.contact_number || "").trim(),
  };
}

export function saveBorrowerProfile(profile) {
  const nextProfile = {
    borrower_name: String(profile.borrower_name || "").trim(),
    borrower_reference: String(profile.borrower_reference || "").trim(),
    department: String(profile.department || "").trim(),
    room_name: String(profile.room_name || "").trim(),
    contact_number: String(profile.contact_number || "").trim(),
  };

  state.borrowerProfile = nextProfile;
  localStorage.setItem(BORROWER_PROFILE_KEY, JSON.stringify(nextProfile));
  return nextProfile;
}

export function publicAuthToken() {
  return localStorage.getItem(PUBLIC_AUTH_TOKEN_KEY) || "";
}

export function savePublicSession(token, profile) {
  localStorage.setItem(PUBLIC_AUTH_TOKEN_KEY, token);
  return saveBorrowerProfile(profile);
}

export function clearPublicSession() {
  localStorage.removeItem(PUBLIC_AUTH_TOKEN_KEY);
  localStorage.removeItem(BORROWER_PROFILE_KEY);
  localStorage.removeItem(TRACKED_REQUESTS_KEY);
  localStorage.removeItem(SEEN_NOTIFICATIONS_KEY);
  state.borrowerProfile = null;
  state.trackedRequests = [];
  state.seenNotifications = {};
}

export function loadSeenNotifications() {
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

export function saveSeenNotifications() {
  localStorage.setItem(
    SEEN_NOTIFICATIONS_KEY,
    JSON.stringify(state.seenNotifications),
  );
}

export function saveTrackedRequests() {
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

export function saveBorrowerProfileFromForm() {
  const profile = {
    borrower_name: elements.borrowerName.value.trim(),
    borrower_reference: elements.borrowerReference.value.trim(),
    department: elements.department.value.trim(),
    room_name: state.borrowerProfile?.room_name || "",
    contact_number: elements.contactNumber.value.trim(),
  };

  if (!profile.borrower_name) return;
  saveBorrowerProfile(profile);
}

export function rememberRequest(request) {
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
