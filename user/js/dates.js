import { DEFAULT_BORROW_DURATION_DAYS } from "./constants.js";

export function localDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return dateInputValue(date);
}

export function dateFromInput(value) {
  const [year, month, day] = String(value || "")
    .split("-")
    .map(Number);

  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function dateInputValue(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function addDaysToInputDate(value, days) {
  const date = dateFromInput(value);
  if (!date) return "";
  date.setDate(date.getDate() + days);
  return dateInputValue(date);
}

export function normalizedDurationDays(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_BORROW_DURATION_DAYS;
  return Math.min(365, Math.max(1, Math.round(parsed)));
}
