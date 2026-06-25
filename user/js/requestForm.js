import { apiRequest } from "./api.js";
import {
  DEFAULT_BORROW_DURATION_DAYS,
  MS_PER_DAY,
} from "./constants.js";
import {
  addDaysToInputDate,
  dateFromInput,
  localDate,
  normalizedDurationDays,
} from "./dates.js";
import { elements } from "./dom.js";
import { loadItems } from "./items.js";
import { loadTrackedRequestStatuses } from "./notifications.js";
import { applyBorrowerProfile, renderVisitorProfile } from "./profile.js";
import {
  rememberRequest,
  saveBorrowerProfileFromForm,
} from "./storage.js";
import { state } from "./state.js";
import { clearMessage, formatRequestId, showMessage } from "./ui.js";

export function updateDueDateFromDuration() {
  const duration = normalizedDurationDays(elements.borrowDuration.value);
  elements.borrowDuration.value = duration;
  elements.dueDate.min = addDaysToInputDate(elements.borrowDate.value, 1);
  elements.dueDate.value = addDaysToInputDate(elements.borrowDate.value, duration);
}

export function updateDurationFromDueDate() {
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

export function openRequestForm(item) {
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

export function closeRequestForm() {
  elements.requestModal.hidden = true;
  state.selectedItem = null;
}

export async function submitBorrowRequest(event) {
  event.preventDefault();
  if (!state.selectedItem) return;

  elements.submitButton.disabled = true;
  elements.submitButton.textContent = "Submitting...";
  clearMessage();

  try {
    const payload = await apiRequest("/public/borrow-requests", {
      method: "POST",
      body: buildBorrowRequestBody(),
    });
    saveBorrowerProfileFromForm();
    renderVisitorProfile();
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

function buildBorrowRequestBody() {
  return {
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
}
